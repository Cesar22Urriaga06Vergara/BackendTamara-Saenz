import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { FormatoReciboDto } from './dto/formato-recibo.dto';
import { PdfReciboService } from './pdf-recibo.service';
import { PdfNovedadService } from './pdf-novedad.service';
import { ExcelReportesService } from './excel-reportes.service';
import { RecaudoService } from '../recaudo/recaudo.service';
import { ContratosService } from '../contratos/contratos.service';
import { InmueblesService } from '../inmuebles/inmuebles.service';
import { EmpresaService } from '../empresa/empresa.service';
import { ObligacionesService } from '../obligaciones/obligaciones.service';
import { NovedadesService } from '../novedades/novedades.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { FiltroReporteNovedadDto } from './dto/filtro-reporte-novedad.dto';
import { ImpactoFinanciero } from '../novedades/entities/novedad.entity';

/** Emisión de documentos oficiales (PDF/Excel) — EXCLUSIVO Administrador, salvo el recibo de reporte de novedad (operativo). */
@ApiTags('Documentos (PDF / Excel)')
@ApiBearerAuth()
@Controller('documentos')
@Roles(Rol.ADMINISTRADOR, Rol.CONTADOR)
export class DocumentosController {
  constructor(
    private readonly pdfRecibo: PdfReciboService,
    private readonly pdfNovedad: PdfNovedadService,
    private readonly excelReportes: ExcelReportesService,
    private readonly recaudoService: RecaudoService,
    private readonly contratosService: ContratosService,
    private readonly inmueblesService: InmueblesService,
    private readonly empresaService: EmpresaService,
    private readonly obligacionesService: ObligacionesService,
    private readonly novedadesService: NovedadesService,
  ) {}

  /** Recibo de reporte de novedad — control interno, SIN impacto financiero. Accesible a Recepcionista (quien registra la novedad). */
  @Get('novedades/:id/pdf')
  @Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)
  @AuditAction({ modulo: 'DOCUMENTOS', accion: 'DESCARGAR_RECIBO_NOVEDAD_PDF' })
  async descargarReciboNovedadPdf(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const novedad = await this.novedadesService.obtener(id);
    const empresa = await this.empresaService.obtener();
    const buffer = await this.pdfNovedad.generar(novedad, empresa);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${novedad.consecutivo ?? novedad.id}.pdf"`);
    res.send(buffer);
  }

  @Get('recibos/:id/pdf')
  @AuditAction({ modulo: 'DOCUMENTOS', accion: 'DESCARGAR_RECIBO_PDF' })
  async descargarReciboPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() { formato = 'CARTA' }: FormatoReciboDto,
    @Res() res: Response,
  ) {
    const recibo = await this.recaudoService.obtener(id);
    const empresa = await this.empresaService.obtener();
    const buffer = await this.pdfRecibo.generar(recibo, empresa, formato);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${recibo.consecutivo}.pdf"`);
    res.send(buffer);
  }

  @Get('reportes/contratos.xlsx')
  @AuditAction({ modulo: 'DOCUMENTOS', accion: 'EXPORTAR_REPORTE_CONTRATOS' })
  async reporteContratos(@Res() res: Response) {
    const data = await this.contratosService.listarTodosParaExport({});
    const buffer = await this.excelReportes.reporteContratos(data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte-contratos.xlsx"');
    res.send(buffer);
  }

  @Get('reportes/inmuebles-por-barrio.xlsx')
  @AuditAction({ modulo: 'DOCUMENTOS', accion: 'EXPORTAR_REPORTE_BARRIO' })
  async reporteBarrio(@Res() res: Response) {
    const data = await this.inmueblesService.listarTodosParaExport({});
    const buffer = await this.excelReportes.reportePorBarrio(data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte-inmuebles-por-barrio.xlsx"');
    res.send(buffer);
  }

  /** Reporte consolidado de recaudo: todos los recibos de caja (emitidos y anulados), efectivo y transferencias. */
  @Get('reportes/recaudo.xlsx')
  @AuditAction({ modulo: 'DOCUMENTOS', accion: 'EXPORTAR_REPORTE_RECAUDO' })
  async reporteRecaudo(@Res() res: Response) {
    const recibos = await this.recaudoService.listarTodosParaExport();
    const buffer = await this.excelReportes.reporteRecaudo(recibos);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte-recaudo.xlsx"');
    res.send(buffer);
  }

  /** Reporte consolidado de cartera: obligaciones pendientes/parciales de todos los contratos. */
  @Get('reportes/cartera.xlsx')
  @AuditAction({ modulo: 'DOCUMENTOS', accion: 'EXPORTAR_REPORTE_CARTERA' })
  async reporteCartera(@Res() res: Response) {
    const obligaciones = await this.obligacionesService.todasPendientes();
    const buffer = await this.excelReportes.reporteCartera(obligaciones);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte-cartera.xlsx"');
    res.send(buffer);
  }

  /** Reporte consolidado de novedades con estado, impacto y monto aprobado. */
  @Get('reportes/novedades.xlsx')
  @AuditAction({ modulo: 'DOCUMENTOS', accion: 'EXPORTAR_REPORTE_NOVEDADES' })
  async reporteNovedades(@Res() res: Response) {
    const novedades = await this.novedadesService.listarTodosParaExport({});
    const buffer = await this.excelReportes.reporteNovedades(novedades);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte-novedades.xlsx"');
    res.send(buffer);
  }

  @Get('reportes/novedades-por-inmueble.xlsx')
  @AuditAction({ modulo: 'DOCUMENTOS', accion: 'EXPORTAR_REPORTE_NOVEDADES_INMUEBLE' })
  async reporteNovedadesPorInmueble(@Query() filtro: FiltroReporteNovedadDto, @Res() res: Response) {
    const novedades = await this.novedadesService.listarTodosParaExport(filtro);
    const buffer = await this.excelReportes.reporteNovedadesPorInmueble(novedades);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte-novedades-por-inmueble.xlsx"');
    res.send(buffer);
  }

  @Get('reportes/novedades-financiero.xlsx')
  @AuditAction({ modulo: 'DOCUMENTOS', accion: 'EXPORTAR_REPORTE_NOVEDADES_FINANCIERO' })
  async reporteNovedadesFinanciero(@Query() filtro: FiltroReporteNovedadDto, @Res() res: Response) {
    const novedades = await this.novedadesService.listarTodosParaExport(filtro);
    const buffer = await this.excelReportes.reporteNovedadesFinanciero(novedades);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte-novedades-financiero.xlsx"');
    res.send(buffer);
  }

  @Get('reportes/gastos-inmobiliaria.xlsx')
  @AuditAction({ modulo: 'DOCUMENTOS', accion: 'EXPORTAR_REPORTE_GASTOS_INMOBILIARIA' })
  async reporteGastosInmobiliaria(@Query() filtro: FiltroReporteNovedadDto, @Res() res: Response) {
    const novedades = await this.novedadesService.listarTodosParaExport({
      ...filtro,
      impactoFinanciero: ImpactoFinanciero.GASTO_INMOBILIARIA,
    });
    const buffer = await this.excelReportes.reporteGastosInmobiliaria(novedades);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte-gastos-inmobiliaria.xlsx"');
    res.send(buffer);
  }

  @Get('reportes/novedades-pendientes.xlsx')
  @AuditAction({ modulo: 'DOCUMENTOS', accion: 'EXPORTAR_REPORTE_NOVEDADES_PENDIENTES' })
  async reporteNovedadesPendientes(@Res() res: Response) {
    const novedades = await this.novedadesService.listarPendientesParaExport();
    const buffer = await this.excelReportes.reporteNovedadesPendientes(novedades);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte-novedades-pendientes.xlsx"');
    res.send(buffer);
  }
}
