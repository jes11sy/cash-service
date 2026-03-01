import { IsString, IsNumber, IsOptional, IsIn, Min, Max, IsPositive, MaxLength, IsArray, ArrayMaxSize, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { SanitizeStringSoft } from '../../utils/sanitize';

export class CreateCashDto {
  @ApiProperty({ enum: ['income', 'expense'] })
  @IsString()
  @IsIn(['income', 'expense'])
  type: string;

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

  @ApiProperty({ required: false, description: 'ID города из references_service' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cityId?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @SanitizeStringSoft()
  @MaxLength(2000, { message: 'Заметка не может быть длиннее 2000 символов' })
  note?: string;

  @ApiProperty({ 
    required: false,
    example: ['director/cash/receipt_doc/uuid1.pdf', 'director/cash/receipt_doc/uuid2.jpg'],
    description: 'Массив S3 ключей чеков (максимум 10 файлов)'
  })
  @IsOptional()
  @IsArray({ message: 'receiptDocs должен быть массивом' })
  @ArrayMaxSize(10, { message: 'Максимум 10 чеков' })
  @IsString({ each: true, message: 'Каждый элемент должен быть строкой' })
  @MaxLength(500, { each: true, message: 'Путь не может быть длиннее 500 символов' })
  receiptDocs?: string[];

  @ApiProperty({ required: false, description: 'Назначение платежа' })
  @IsString()
  @IsOptional()
  @SanitizeStringSoft()
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

  @ApiProperty({ required: false, enum: ['income', 'expense'] })
  @IsString()
  @IsOptional()
  @IsIn(['income', 'expense'])
  type?: string;

  @ApiProperty({ required: false, description: 'ID города из references_service' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cityId?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @SanitizeStringSoft()
  @MaxLength(2000)
  note?: string;

  @ApiProperty({ 
    required: false,
    example: ['director/cash/receipt_doc/uuid1.pdf', 'director/cash/receipt_doc/uuid2.jpg'],
    description: 'Массив S3 ключей чеков (максимум 10 файлов)'
  })
  @IsOptional()
  @IsArray({ message: 'receiptDocs должен быть массивом' })
  @ArrayMaxSize(10, { message: 'Максимум 10 чеков' })
  @IsString({ each: true, message: 'Каждый элемент должен быть строкой' })
  @MaxLength(500, { each: true, message: 'Путь не может быть длиннее 500 символов' })
  receiptDocs?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @SanitizeStringSoft()
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
  @SanitizeStringSoft()
  @MaxLength(1000)
  note?: string;
}
