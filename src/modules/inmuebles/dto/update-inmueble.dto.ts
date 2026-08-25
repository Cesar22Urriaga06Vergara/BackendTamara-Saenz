import { PartialType } from '@nestjs/swagger';
import { CreateInmuebleDto } from './create-inmueble.dto';

export class UpdateInmuebleDto extends PartialType(CreateInmuebleDto) {}
