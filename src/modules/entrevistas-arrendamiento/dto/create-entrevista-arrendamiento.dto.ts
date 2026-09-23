import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoCivilEntrevista, TipoDocumentoEntrevista } from '../entities/entrevista-arrendamiento.entity';

export class CreateEntrevistaArrendamientoDto {
  @IsString() @MaxLength(150) nombreCompleto: string;
  @IsString() @MaxLength(30) numeroDocumento: string;
  @IsOptional() @IsEnum(TipoDocumentoEntrevista) tipoDocumento?: TipoDocumentoEntrevista;
  @IsOptional() @IsDateString() fechaNacimiento?: string;
  @IsOptional() @IsEnum(EstadoCivilEntrevista) estadoCivil?: EstadoCivilEntrevista;
  @IsOptional() @IsString() @MaxLength(30) telefono?: string;
  @IsOptional() @IsEmail() @MaxLength(150) correoElectronico?: string;
  @IsOptional() @IsString() personasInmueble?: string;
  @IsOptional() @IsInt() @Min(1) numeroPersonas?: number;
  @IsOptional() @IsString() detallePersonas?: string;
  @IsOptional() @IsString() @MaxLength(150) empresaActividad?: string;
  @IsOptional() @IsString() @MaxLength(120) cargo?: string;
  @IsOptional() @IsString() @MaxLength(80) tipoContratoLaboral?: string;
  @IsOptional() @IsString() @MaxLength(80) tiempoLaborando?: string;
  @IsOptional() @IsNumber() @Min(0) ingresosMensuales?: number;
  @IsOptional() @IsNumber() @Min(0) otrosIngresos?: number;
  @IsOptional() @IsBoolean() presentaSoportes?: boolean;
  @IsOptional() @IsString() direccionActual?: string;
  @IsOptional() @IsString() motivoMudanza?: string;
  @IsOptional() @IsString() @MaxLength(150) arrendadorAnterior?: string;
  @IsOptional() @IsString() @MaxLength(30) telefonoArrendadorAnterior?: string;
  @IsOptional() @IsString() problemasPago?: string;
  @IsOptional() @IsString() @MaxLength(30) tiempoDireccionActual?: string;
  @IsOptional() @IsString() @MaxLength(150) referenciaLaboral?: string;
  @IsOptional() @IsString() @MaxLength(30) telefonoReferenciaLaboral?: string;
  @IsOptional() @IsString() @MaxLength(150) empresaReferenciaLaboral?: string;
  @IsOptional() @IsString() @MaxLength(150) referenciaPersonal?: string;
  @IsOptional() @IsString() @MaxLength(30) telefonoReferenciaPersonal?: string;
  @IsOptional() @IsString() @MaxLength(100) relacionReferenciaPersonal?: string;
  @IsOptional() @IsString() @MaxLength(150) referenciaFamiliar?: string;
  @IsOptional() @IsString() @MaxLength(30) telefonoReferenciaFamiliar?: string;
  @IsOptional() @IsString() @MaxLength(100) parentescoReferenciaFamiliar?: string;
  @IsOptional() @IsString() mascotas?: string;
  @IsOptional() @IsBoolean() tieneMascotas?: boolean;
  @IsOptional() @IsString() detalleMascotas?: string;
  @IsOptional() @IsBoolean() fuma?: boolean;
  @IsOptional() @IsString() @MaxLength(80) permanenciaEstimada?: string;
  @IsOptional() @IsString() @MaxLength(150) fiadorCodeudor?: string;
  @IsOptional() @IsBoolean() tieneFiador?: boolean;
  @IsOptional() @IsString() @MaxLength(150) fiadorNombreCompleto?: string;
  @IsOptional() @IsEnum(TipoDocumentoEntrevista) fiadorTipoDocumento?: TipoDocumentoEntrevista;
  @IsOptional() @IsString() @MaxLength(30) fiadorNumeroDocumento?: string;
  @IsOptional() @IsString() @MaxLength(30) fiadorTelefono?: string;
  @IsOptional() @IsString() fiadorDireccion?: string;
  @IsOptional() @IsString() @MaxLength(100) fiadorRelacion?: string;
  @IsOptional() @IsBoolean() aceptaEstudioCredito?: boolean;
  @IsOptional() @IsString() observaciones?: string;
  @IsOptional() @IsString() @MaxLength(150) firmaSolicitante?: string;
  @IsOptional() @IsDateString() fechaFirma?: string;
  @IsOptional() @IsUUID() clienteId?: string;
  @IsOptional() @IsUUID() inmuebleId?: string;
  @IsOptional() @IsUUID() contratoId?: string;
}
