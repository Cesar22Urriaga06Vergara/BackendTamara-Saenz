import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { SanitizarHtmlPipe } from './common/pipes/sanitizar-html.pipe';
import { TypeOrmExceptionFilter } from './common/filters/typeorm-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Cabeceras de seguridad (nosniff, frameguard, HSTS, referrer-policy, etc.). La CSP se
  // relaja lo justo para que Swagger UI (solo fuera de producción) siga cargando su bundle.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
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
    console.warn(
      `TRUST_PROXY="${trustProxy}" no es un valor reconocido ("false", "true" o un número de saltos). Se ignora: trust proxy queda deshabilitado.`,
    );
    app.set('trust proxy', false);
  }

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

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
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3001'),
    credentials: true,
  });

  // Swagger expone el esquema completo de la API (todas las rutas, DTOs y formas de
  // respuesta) sin pasar por JwtAuthGuard/RolesGuard, que solo protegen rutas enrutadas por
  // Nest — la UI de Swagger se sirve fuera de ese pipeline. Solo se habilita fuera de
  // producción para no exponer el mapa completo del API a cualquiera con acceso de red.
  const esProduccion = config.get<string>('NODE_ENV') === 'production';
  let swaggerHabilitado = false;
  if (!esProduccion) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ERP Inmobiliario - Inversiones Tamara & Saenz S. En C.')
      .setDescription('API de control de recaudo, contratos, inmuebles y novedades operativas.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${prefix}/docs`, app, document);
    swaggerHabilitado = true;
  }

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(`🚀 API Tamara & Saenz corriendo en http://localhost:${port}/${prefix}`);
  if (swaggerHabilitado) {
    console.log(`📄 Swagger disponible en http://localhost:${port}/${prefix}/docs`);
  }
}
void bootstrap();
