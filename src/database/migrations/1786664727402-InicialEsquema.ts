import { MigrationInterface, QueryRunner } from "typeorm";

export class InicialEsquema1786664727402 implements MigrationInterface {
    name = 'InicialEsquema1786664727402'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`usuario\` (\`id\` varchar(36) NOT NULL, \`nombreCompleto\` varchar(150) NOT NULL, \`email\` varchar(150) NOT NULL, \`passwordHash\` varchar(255) NOT NULL, \`rol\` enum ('ADMINISTRADOR', 'RECEPCIONISTA') NOT NULL DEFAULT 'RECEPCIONISTA', \`activo\` tinyint NOT NULL DEFAULT 1, \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`actualizadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_2863682842e688ca198eb25c12\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`cliente\` (\`id\` varchar(36) NOT NULL, \`numeroDocumento\` varchar(30) NOT NULL, \`tipoDocumento\` varchar(20) NOT NULL DEFAULT 'CC', \`nombreCompleto\` varchar(150) NOT NULL, \`email\` varchar(150) NULL, \`telefono\` varchar(30) NULL, \`direccion\` varchar(300) NULL, \`activo\` tinyint NOT NULL DEFAULT 1, \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`actualizadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_d62016bd89738736157a8c5bd3\` (\`numeroDocumento\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`codeudor\` (\`id\` varchar(36) NOT NULL, \`numeroDocumento\` varchar(30) NOT NULL, \`tipoDocumento\` varchar(20) NOT NULL DEFAULT 'CC', \`nombreCompleto\` varchar(150) NOT NULL, \`email\` varchar(150) NULL, \`telefono\` varchar(30) NULL, \`direccion\` varchar(300) NULL, \`activo\` tinyint NOT NULL DEFAULT 1, \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`actualizadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_22ce2c9d6fa9deea1547bb1c79\` (\`numeroDocumento\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`inmueble\` (\`id\` varchar(36) NOT NULL, \`direccion\` varchar(300) NOT NULL, \`barrio\` varchar(120) NOT NULL, \`canonValor\` decimal(12,2) NOT NULL, \`depositoValor\` decimal(12,2) NULL, \`codigoEnergia\` varchar(40) NULL, \`codigoAgua\` varchar(40) NULL, \`codigoGas\` varchar(40) NULL, \`estado\` enum ('DISPONIBLE', 'OCUPADO', 'MANTENIMIENTO', 'INACTIVO') NOT NULL DEFAULT 'DISPONIBLE', \`observaciones\` text NULL, \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`actualizadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_1266eb16a7125d1f8f2a7ca2c7\` (\`barrio\`), INDEX \`IDX_f12eaa67a2c22fadb52543c8e5\` (\`estado\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`contrato\` (\`id\` varchar(36) NOT NULL, \`fechaInicio\` date NOT NULL, \`fechaFin\` date NULL, \`diaPago\` int NOT NULL DEFAULT '5', \`canonValor\` decimal(12,2) NOT NULL, \`saldoAFavor\` decimal(12,2) NOT NULL DEFAULT '0.00', \`depositoCustodia\` decimal(12,2) NOT NULL DEFAULT '0.00', \`estado\` enum ('ACTIVO', 'SUSPENDIDO', 'EN_TERMINACION', 'TERMINADO') NOT NULL DEFAULT 'ACTIVO', \`motivoTerminacion\` text NULL, \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`actualizadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`clienteId\` varchar(36) NOT NULL, \`inmuebleId\` varchar(36) NOT NULL, INDEX \`IDX_ed461037cb1a56f3bebd2e4ec5\` (\`inmuebleId\`), INDEX \`IDX_9d857eafafacd5d0c3d9fe8db0\` (\`estado\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`detalle_pago\` (\`id\` varchar(36) NOT NULL, \`medioPago\` enum ('EFECTIVO', 'TRANSFERENCIA', 'CONSIGNACION', 'OTRO') NOT NULL, \`monto\` decimal(12,2) NOT NULL, \`referencia\` varchar(100) NULL, \`reciboId\` varchar(36) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`recibo_caja\` (\`id\` varchar(36) NOT NULL, \`consecutivo\` varchar(20) NOT NULL, \`valorTotal\` decimal(12,2) NOT NULL, \`excedente\` decimal(12,2) NOT NULL DEFAULT '0.00', \`estado\` enum ('EMITIDO', 'ANULADO') NOT NULL DEFAULT 'EMITIDO', \`motivoAnulacion\` text NULL, \`registradoPorEmail\` varchar(150) NOT NULL, \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`contratoId\` varchar(36) NOT NULL, UNIQUE INDEX \`IDX_489782bd65f07fc0c352a5f96c\` (\`consecutivo\`), INDEX \`IDX_6365981dea063b989f09bb548e\` (\`contratoId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`obligacion\` (\`id\` varchar(36) NOT NULL, \`tipo\` enum ('CANON', 'NOVEDAD') NOT NULL, \`concepto\` varchar(200) NOT NULL, \`periodo\` date NOT NULL, \`fechaVencimiento\` date NOT NULL, \`valorOriginal\` decimal(12,2) NOT NULL, \`valorAbonado\` decimal(12,2) NOT NULL DEFAULT '0.00', \`valorMoraAcumulada\` decimal(12,2) NOT NULL DEFAULT '0.00', \`estado\` enum ('PENDIENTE', 'PARCIAL', 'PAGADA', 'ANULADA') NOT NULL DEFAULT 'PENDIENTE', \`novedadOrigenId\` varchar(255) NULL, \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`actualizadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`contratoId\` varchar(36) NOT NULL, INDEX \`IDX_6dee8f84da753ed02b967954fa\` (\`contratoId\`), INDEX \`IDX_94f2af8dd5c04bd63caaf07626\` (\`estado\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`aplicacion_pago\` (\`id\` varchar(36) NOT NULL, \`montoAplicado\` decimal(12,2) NOT NULL, \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`reciboId\` varchar(36) NULL, \`obligacionId\` varchar(36) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`novedad\` (\`id\` varchar(36) NOT NULL, \`descripcion\` text NOT NULL, \`fecha\` date NOT NULL, \`observaciones\` text NULL, \`responsableSugerido\` enum ('INMOBILIARIA', 'ARRENDATARIO') NOT NULL DEFAULT 'INMOBILIARIA', \`estado\` enum ('ABIERTA', 'EN_SEGUIMIENTO', 'CERRADA', 'ANULADA') NOT NULL DEFAULT 'ABIERTA', \`impactoFinanciero\` enum ('PENDIENTE', 'CARGO_ARRENDATARIO', 'GASTO_INMOBILIARIA') NOT NULL DEFAULT 'PENDIENTE', \`montoAprobado\` decimal(12,2) NULL, \`registradoPorEmail\` varchar(150) NULL, \`aprobadoPorEmail\` varchar(150) NULL, \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`actualizadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`inmuebleId\` varchar(36) NOT NULL, \`contratoId\` varchar(36) NULL, INDEX \`IDX_8ef3830ac66a91d4c91bb8dec5\` (\`inmuebleId\`), INDEX \`IDX_8569065341b03773b2b29ecedb\` (\`estado\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`movimiento\` (\`id\` varchar(36) NOT NULL, \`tipo\` enum ('INGRESO', 'EGRESO') NOT NULL, \`origen\` enum ('RECAUDO', 'NOVEDAD', 'DEPOSITO', 'MANUAL') NOT NULL, \`concepto\` varchar(200) NOT NULL, \`monto\` decimal(12,2) NOT NULL, \`reciboId\` varchar(255) NULL, \`novedadId\` varchar(255) NULL, \`contratoId\` varchar(255) NULL, \`registradoPorEmail\` varchar(150) NOT NULL, \`esReverso\` tinyint NOT NULL DEFAULT 0, \`movimientoOriginalId\` varchar(255) NULL, \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_1cc85f3409fa42b33ce52d8975\` (\`tipo\`), INDEX \`IDX_d2bf9dd80ac8ebf6fdf2661a57\` (\`creadoEn\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`empresa\` (\`id\` varchar(36) NOT NULL, \`nombre\` varchar(200) NOT NULL, \`nit\` varchar(30) NOT NULL, \`slogan\` varchar(150) NOT NULL DEFAULT 'Resolvemos tu situacion', \`direccion\` varchar(300) NULL, \`telefono\` varchar(30) NULL, \`logoUrl\` varchar(300) NULL, \`diasGraciaMora\` int NOT NULL DEFAULT '5', \`porcentajeMoraMensual\` decimal(5,2) NOT NULL DEFAULT '1.50', \`horizonteMesesCanon\` int NOT NULL DEFAULT '3', \`actualizadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_51ac4482e14d7afaa64eab9c5a\` (\`nit\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`consecutivo\` (\`id\` varchar(36) NOT NULL, \`tipo\` varchar(40) NOT NULL, \`prefijo\` varchar(10) NOT NULL DEFAULT '', \`ultimoNumero\` bigint NOT NULL DEFAULT '0', \`version\` int NOT NULL, UNIQUE INDEX \`IDX_1eee8926633b88dd4376be52d1\` (\`tipo\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`refresh_token\` (\`id\` varchar(36) NOT NULL, \`usuarioId\` varchar(255) NOT NULL, \`tokenHash\` varchar(128) NOT NULL, \`expiraEn\` datetime NOT NULL, \`revocado\` tinyint NOT NULL DEFAULT 0, \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_6f6e8bfdbac7904b7dc427f3b3\` (\`usuarioId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`registro_auditoria\` (\`id\` varchar(36) NOT NULL, \`modulo\` varchar(60) NOT NULL, \`accion\` varchar(80) NOT NULL, \`usuarioEmail\` varchar(150) NOT NULL, \`metodoHttp\` varchar(10) NOT NULL, \`ruta\` varchar(300) NOT NULL, \`duracionMs\` int NOT NULL, \`ipOrigen\` varchar(45) NULL, \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_0b7cb75870e325107ca1117f95\` (\`modulo\`), INDEX \`IDX_9a2d057150a7a8d5435f4e9610\` (\`accion\`), INDEX \`IDX_c9009d60b312b5c1d354dd10cc\` (\`creadoEn\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`contrato_codeudores\` (\`contratoId\` varchar(36) NOT NULL, \`codeudorId\` varchar(36) NOT NULL, INDEX \`IDX_54f072c57ed7125e599c9045e3\` (\`contratoId\`), INDEX \`IDX_79ac00067079360dd003d5c1e6\` (\`codeudorId\`), PRIMARY KEY (\`contratoId\`, \`codeudorId\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`contrato\` ADD CONSTRAINT \`FK_af00d0b492ad1eab600402d9b59\` FOREIGN KEY (\`clienteId\`) REFERENCES \`cliente\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`contrato\` ADD CONSTRAINT \`FK_ed461037cb1a56f3bebd2e4ec5c\` FOREIGN KEY (\`inmuebleId\`) REFERENCES \`inmueble\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`detalle_pago\` ADD CONSTRAINT \`FK_d5e4a9910782afbdee130fd0752\` FOREIGN KEY (\`reciboId\`) REFERENCES \`recibo_caja\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`recibo_caja\` ADD CONSTRAINT \`FK_6365981dea063b989f09bb548ed\` FOREIGN KEY (\`contratoId\`) REFERENCES \`contrato\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`obligacion\` ADD CONSTRAINT \`FK_6dee8f84da753ed02b967954fa3\` FOREIGN KEY (\`contratoId\`) REFERENCES \`contrato\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`aplicacion_pago\` ADD CONSTRAINT \`FK_6de16dcbcbcad08d0be265791e2\` FOREIGN KEY (\`reciboId\`) REFERENCES \`recibo_caja\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`aplicacion_pago\` ADD CONSTRAINT \`FK_3adb77be99386697a741ffb7b8d\` FOREIGN KEY (\`obligacionId\`) REFERENCES \`obligacion\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`novedad\` ADD CONSTRAINT \`FK_8ef3830ac66a91d4c91bb8dec53\` FOREIGN KEY (\`inmuebleId\`) REFERENCES \`inmueble\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`novedad\` ADD CONSTRAINT \`FK_7d0bbb67f73b3e7b5a41d4ad35d\` FOREIGN KEY (\`contratoId\`) REFERENCES \`contrato\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`contrato_codeudores\` ADD CONSTRAINT \`FK_54f072c57ed7125e599c9045e36\` FOREIGN KEY (\`contratoId\`) REFERENCES \`contrato\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`contrato_codeudores\` ADD CONSTRAINT \`FK_79ac00067079360dd003d5c1e69\` FOREIGN KEY (\`codeudorId\`) REFERENCES \`codeudor\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`contrato_codeudores\` DROP FOREIGN KEY \`FK_79ac00067079360dd003d5c1e69\``);
        await queryRunner.query(`ALTER TABLE \`contrato_codeudores\` DROP FOREIGN KEY \`FK_54f072c57ed7125e599c9045e36\``);
        await queryRunner.query(`ALTER TABLE \`novedad\` DROP FOREIGN KEY \`FK_7d0bbb67f73b3e7b5a41d4ad35d\``);
        await queryRunner.query(`ALTER TABLE \`novedad\` DROP FOREIGN KEY \`FK_8ef3830ac66a91d4c91bb8dec53\``);
        await queryRunner.query(`ALTER TABLE \`aplicacion_pago\` DROP FOREIGN KEY \`FK_3adb77be99386697a741ffb7b8d\``);
        await queryRunner.query(`ALTER TABLE \`aplicacion_pago\` DROP FOREIGN KEY \`FK_6de16dcbcbcad08d0be265791e2\``);
        await queryRunner.query(`ALTER TABLE \`obligacion\` DROP FOREIGN KEY \`FK_6dee8f84da753ed02b967954fa3\``);
        await queryRunner.query(`ALTER TABLE \`recibo_caja\` DROP FOREIGN KEY \`FK_6365981dea063b989f09bb548ed\``);
        await queryRunner.query(`ALTER TABLE \`detalle_pago\` DROP FOREIGN KEY \`FK_d5e4a9910782afbdee130fd0752\``);
        await queryRunner.query(`ALTER TABLE \`contrato\` DROP FOREIGN KEY \`FK_ed461037cb1a56f3bebd2e4ec5c\``);
        await queryRunner.query(`ALTER TABLE \`contrato\` DROP FOREIGN KEY \`FK_af00d0b492ad1eab600402d9b59\``);
        await queryRunner.query(`DROP INDEX \`IDX_79ac00067079360dd003d5c1e6\` ON \`contrato_codeudores\``);
        await queryRunner.query(`DROP INDEX \`IDX_54f072c57ed7125e599c9045e3\` ON \`contrato_codeudores\``);
        await queryRunner.query(`DROP TABLE \`contrato_codeudores\``);
        await queryRunner.query(`DROP INDEX \`IDX_c9009d60b312b5c1d354dd10cc\` ON \`registro_auditoria\``);
        await queryRunner.query(`DROP INDEX \`IDX_9a2d057150a7a8d5435f4e9610\` ON \`registro_auditoria\``);
        await queryRunner.query(`DROP INDEX \`IDX_0b7cb75870e325107ca1117f95\` ON \`registro_auditoria\``);
        await queryRunner.query(`DROP TABLE \`registro_auditoria\``);
        await queryRunner.query(`DROP INDEX \`IDX_6f6e8bfdbac7904b7dc427f3b3\` ON \`refresh_token\``);
        await queryRunner.query(`DROP TABLE \`refresh_token\``);
        await queryRunner.query(`DROP INDEX \`IDX_1eee8926633b88dd4376be52d1\` ON \`consecutivo\``);
        await queryRunner.query(`DROP TABLE \`consecutivo\``);
        await queryRunner.query(`DROP INDEX \`IDX_51ac4482e14d7afaa64eab9c5a\` ON \`empresa\``);
        await queryRunner.query(`DROP TABLE \`empresa\``);
        await queryRunner.query(`DROP INDEX \`IDX_d2bf9dd80ac8ebf6fdf2661a57\` ON \`movimiento\``);
        await queryRunner.query(`DROP INDEX \`IDX_1cc85f3409fa42b33ce52d8975\` ON \`movimiento\``);
        await queryRunner.query(`DROP TABLE \`movimiento\``);
        await queryRunner.query(`DROP INDEX \`IDX_8569065341b03773b2b29ecedb\` ON \`novedad\``);
        await queryRunner.query(`DROP INDEX \`IDX_8ef3830ac66a91d4c91bb8dec5\` ON \`novedad\``);
        await queryRunner.query(`DROP TABLE \`novedad\``);
        await queryRunner.query(`DROP TABLE \`aplicacion_pago\``);
        await queryRunner.query(`DROP INDEX \`IDX_94f2af8dd5c04bd63caaf07626\` ON \`obligacion\``);
        await queryRunner.query(`DROP INDEX \`IDX_6dee8f84da753ed02b967954fa\` ON \`obligacion\``);
        await queryRunner.query(`DROP TABLE \`obligacion\``);
        await queryRunner.query(`DROP INDEX \`IDX_6365981dea063b989f09bb548e\` ON \`recibo_caja\``);
        await queryRunner.query(`DROP INDEX \`IDX_489782bd65f07fc0c352a5f96c\` ON \`recibo_caja\``);
        await queryRunner.query(`DROP TABLE \`recibo_caja\``);
        await queryRunner.query(`DROP TABLE \`detalle_pago\``);
        await queryRunner.query(`DROP INDEX \`IDX_9d857eafafacd5d0c3d9fe8db0\` ON \`contrato\``);
        await queryRunner.query(`DROP INDEX \`IDX_ed461037cb1a56f3bebd2e4ec5\` ON \`contrato\``);
        await queryRunner.query(`DROP TABLE \`contrato\``);
        await queryRunner.query(`DROP INDEX \`IDX_f12eaa67a2c22fadb52543c8e5\` ON \`inmueble\``);
        await queryRunner.query(`DROP INDEX \`IDX_1266eb16a7125d1f8f2a7ca2c7\` ON \`inmueble\``);
        await queryRunner.query(`DROP TABLE \`inmueble\``);
        await queryRunner.query(`DROP INDEX \`IDX_22ce2c9d6fa9deea1547bb1c79\` ON \`codeudor\``);
        await queryRunner.query(`DROP TABLE \`codeudor\``);
        await queryRunner.query(`DROP INDEX \`IDX_d62016bd89738736157a8c5bd3\` ON \`cliente\``);
        await queryRunner.query(`DROP TABLE \`cliente\``);
        await queryRunner.query(`DROP INDEX \`IDX_2863682842e688ca198eb25c12\` ON \`usuario\``);
        await queryRunner.query(`DROP TABLE \`usuario\``);
    }

}
