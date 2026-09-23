import { Module } from '@nestjs/common';
import { PdfReciboService } from './pdf-recibo.service';
import { PdfNovedadService } from './pdf-novedad.service';
import { ExcelReportesService } from './excel-reportes.service';
import { DocumentosController } from './documentos.controller';
import { RecaudoModule } from '../recaudo/recaudo.module';
import { ContratosModule } from '../contratos/contratos.module';
import { InmueblesModule } from '../inmuebles/inmuebles.module';
import { EmpresaModule } from '../empresa/empresa.module';
import { ObligacionesModule } from '../obligaciones/obligaciones.module';
import { NovedadesModule } from '../novedades/novedades.module';
import { EntrevistasArrendamientoModule } from '../entrevistas-arrendamiento/entrevistas-arrendamiento.module';
import { PdfEntrevistaArrendamientoService } from './pdf-entrevista-arrendamiento.service';

@Module({
  imports: [
    RecaudoModule,
    ContratosModule,
    InmueblesModule,
    EmpresaModule,
    ObligacionesModule,
    NovedadesModule,
    EntrevistasArrendamientoModule,
  ],
  controllers: [DocumentosController],
  providers: [PdfReciboService, PdfNovedadService, PdfEntrevistaArrendamientoService, ExcelReportesService],
  exports: [PdfReciboService, PdfNovedadService, PdfEntrevistaArrendamientoService, ExcelReportesService],
})
export class DocumentosModule {}
