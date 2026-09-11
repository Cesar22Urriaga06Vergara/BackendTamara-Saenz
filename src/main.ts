import './instrument'; // debe ir PRIMERO: inicializa Sentry antes que cualquier módulo de la app
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { SanitizarHtmlPipe } from './common/pipes/sanitizar-html.pipe';
import { TypeOrmExceptionFilter } from './common/filters/typeorm-exception.filter';
import { validarSecretoJwt } from './common/utils/validar-secreto-jwt.util';
import { directorioUploads, PREFIJO_PUBLICO_UPLOADS } from './common/utils/rutas-archivos.util';

async function bootstrap() {
  // `bufferLogs: true`: retiene los logs del arranque hasta que se instala el logger de pino.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger)); // logger estructurado (nestjs-pino) para toda la app
  const logger = app.get(Logger);
  const config = app.get(ConfigService);

  // Aborta el arranque si el secreto que firma los access tokens es débil o de ejemplo (S-1).
  validarSecretoJwt(config.get<string>('JWT_ACCESS_SECRET'));

  // Cabeceras de seguridad (nosniff, frameguard, HSTS, referrer-policy, etc.). El backend solo
  // sirve `/api` (JSON) y `/uploads` (estáticos); el frontend es una app aparte en Cloudflare
  // Pages, así que la CSP puede ser estricta. Swagger (solo con SWAGGER_ENABLED=true, apagado en
  // prod) necesita `'unsafe-inline'` en `style-src`; el `script-src` ya no lo lleva.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"], // Swagger UI y algunos estilos inline propios
          'img-src': ["'self'", 'data:'],
          'object-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          'base-uri': ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // el logo en /uploads lo consume el frontend en otro origen
    }),
  );

  // Detrás de un reverse-proxy (nginx, LB, Cloudflare), Express necesita saber cuántos saltos
  // de proxy confiar para que `req.ip` sea la IP real del cliente y no la del proxy — clave
  // para que la traza de auditoría (`ipOrigen`) sirva. Valor por env: número de saltos, "true"/
  // "false", o vacío. Cualquier otro texto (p. ej. un typo) cae a "sin proxy" en vez de
  // propagarse crudo a Express: `app.set('trust proxy', <string no reconocido>)` intenta
  // parsearlo como IP/subred y LANZA de forma síncrona en el bootstrap sin try/catch — tumbaría
  // el backend entero al arrancar. Mismo criterio de "formato desconocido → default seguro" que
  // parseExpiracionAMs en auth.service.ts.
  const trustProxy = config.get<string>('TRUST_PROXY', 'false');
  if (trustProxy === 'false') {
    app.set('trust proxy', false);
  } else if (trustProxy === 'true') {
    app.set('trust proxy', true);
  } else if (/^\d+$/.test(trustProxy)) {
    app.set('trust proxy', Number(trustProxy));
  } else {
    logger.warn(
      `TRUST_PROXY="${trustProxy}" no es un valor reconocido ("false", "true" o un número de saltos). Se ignora: trust proxy queda deshabilitado.`,
    );
    app.set('trust proxy', false);
  }

  app.useStaticAssets(directorioUploads(), { prefix: PREFIJO_PUBLICO_UPLOADS });

  app.useGlobalFilters(new TypeOrmExceptionFilter());

  const prefix = config.get<string>('API_PREFIX', 'api');
  app.setGlobalPrefix(prefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new SanitizarHtmlPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN')
      ? config
          .get<string>('CORS_ORIGIN')!
          .split(',')
          .map((origin) => origin.trim())
      : '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Swagger expone el esquema completo de la API (todas las rutas, DTOs y formas de
  // respuesta) sin pasar por JwtAuthGuard/RolesGuard, que solo protegen rutas enrutadas por
  // Nest — la UI de Swagger se sirve fuera de ese pipeline. Antes se encendía salvo cuando
  // NODE_ENV === 'production'; pero si NODE_ENV no se fija (o queda en 'development' en el .env
  // de producción, hallazgo S-7) quedaba expuesto por accidente. Ahora exige opt-in explícito.
  const swaggerHabilitado = config.get<string>('SWAGGER_ENABLED') === 'true';
  if (swaggerHabilitado) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ERP Inmobiliario - Inversiones Tamara & Saenz S. En C.')
      .setDescription('API de control de recaudo, contratos, inmuebles y novedades operativas.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${prefix}/docs`, app, document);
  }

  const port = config.get<number>('PORT', 3010);
  // '0.0.0.0' explícito: en un contenedor (Railway) hay que escuchar en todas las interfaces,
  // no solo en localhost, para que el proxy del proveedor pueda enrutar el tráfico.
  await app.listen(port, '0.0.0.0');

  logger.log(`API Tamara & Saenz escuchando en el puerto ${port} (prefijo /${prefix})`);
  if (swaggerHabilitado) {
    logger.log(`Swagger disponible en /${prefix}/docs`);
  }
}
void bootstrap();
