import { IsString, IsNumber, IsOptional, IsIn, Min, Max, IsPositive, MaxLength, Matches, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { SanitizeString, SanitizeStringSoft } from '../../utils/sanitize';

export class CreateCashDto {
  @ApiProperty({ enum: ['приход', 'расход'] })
  @IsString()
  @IsIn(['приход', 'расход'])
  name: string;

  @ApiProperty({ 
    example: 1000.50,
    description: 'Сумма транзакции (положительное число, максимум 2 знака после запятой)',
    minimum: 0.01,
    maximum: 9999999.99 
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Сумма может иметь максимум 2 знака после запятой' })
  @IsPositive({ message: 'Сумма должна быть положительной' })
  @Min(0.01, { message: 'Минимальная сумма: 0.01' })
  @Max(9999999.99, { message: 'Максимальная сумма: 9,999,999.99' })
  amount: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @SanitizeString()
  city?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @SanitizeStringSoft() // 🔒 Мягкая санитизация для заметок
  @MaxLength(2000, { message: 'Заметка не может быть длиннее 2000 символов' })
  note?: string;

  @ApiProperty({ 
    required: false,
    example: 'director/cash/receipt_doc/uuid-v4.pdf',
    description: 'S3 ключ или URL документа/чека (PDF/JPG/PNG)'
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Путь не может быть длиннее 500 символов' })
  @ValidateIf((o) => o.receiptDoc !== '' && o.receiptDoc !== undefined) // 🔧 FIX: Позволяет пустую строку
  @Matches(/\.(pdf|jpg|jpeg|png)$/i, { message: 'Разрешены только файлы: PDF, JPG, PNG' })
  receiptDoc?: string;

  @ApiProperty({ required: false, description: 'Назначение платежа (уникальный идентификатор заказа)' })
  @IsString()
  @IsOptional()
  @SanitizeString() // 🔒 XSS защита
  @MaxLength(200)
  paymentPurpose?: string;
}

export class UpdateCashDto {
  @ApiProperty({ 
    required: false,
    example: 1000.50,
    minimum: 0.01,
    maximum: 9999999.99 
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Сумма может иметь максимум 2 знака после запятой' })
  @IsPositive({ message: 'Сумма должна быть положительной' })
  @Min(0.01, { message: 'Минимальная сумма: 0.01' })
  @Max(9999999.99, { message: 'Максимальная сумма: 9,999,999.99' })
  amount?: number;

  @ApiProperty({ required: false, enum: ['приход', 'расход'] })
  @IsString()
  @IsOptional()
  @IsIn(['приход', 'расход']) // 🔧 FIX: Добавлена валидация значений
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @SanitizeString() // 🔒 XSS защита
  city?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @SanitizeStringSoft() // 🔒 Мягкая санитизация для заметок
  @MaxLength(2000)
  note?: string;

  @ApiProperty({ 
    required: false,
    example: 'director/cash/receipt_doc/uuid-v4.pdf'
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ValidateIf((o) => o.receiptDoc !== '' && o.receiptDoc !== undefined) // 🔧 FIX: Позволяет пустую строку
  @Matches(/\.(pdf|jpg|jpeg|png)$/i, { message: 'Разрешены только файлы: PDF, JPG, PNG' })
  receiptDoc?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @SanitizeString() // 🔒 XSS защита
  @MaxLength(200)
  paymentPurpose?: string;
}

export class ApproveCashDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsString()
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @SanitizeStringSoft() // 🔒 Мягкая санитизация для заметок
  @MaxLength(1000)
  note?: string;
}














