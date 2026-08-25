import { PartialType } from '@nestjs/swagger';
import { CreatePropietarioDto } from './create-propietario.dto';

export class UpdatePropietarioDto extends PartialType(CreatePropietarioDto) {}
