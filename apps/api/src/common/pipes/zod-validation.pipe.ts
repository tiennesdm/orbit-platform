import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: any) {
    try {
      const parsed = this.schema.parse(value);
      return parsed;
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        throw new BadRequestException(`Validation failed: ${messages}`);
      }
      throw err;
    }
  }
}
