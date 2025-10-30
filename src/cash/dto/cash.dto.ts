import { IsString, IsNumber, IsOptional, IsIn, Min, Max, IsPositive, IsUrl, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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
  city?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({ 
    required: false,
    example: 'https://storage.example.com/receipts/uuid-v4.pdf',
    description: 'URL документа/чека (только HTTPS, только PDF/JPG/PNG)'
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Должен быть валидный HTTPS URL' })
  @MaxLength(500, { message: 'URL не может быть длиннее 500 символов' })
  @Matches(/\.(pdf|jpg|jpeg|png)$/i, { message: 'Разрешены только файлы: PDF, JPG, PNG' })
  receiptDoc?: string;

  @ApiProperty({ required: false, description: 'Назначение платежа (уникальный идентификатор заказа)' })
  @IsString()
  @IsOptional()
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
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({ 
    required: false,
    example: 'https://storage.example.com/receipts/uuid-v4.pdf'
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  @Matches(/\.(pdf|jpg|jpeg|png)$/i)
  receiptDoc?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
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
  note?: string;
}














