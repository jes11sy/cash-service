import { IsOptional, IsString, IsIn, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO для валидации query параметров при получении транзакций
 */
export class GetCashQueryDto {
  @ApiProperty({ 
    required: false, 
    enum: ['income', 'expense'],
    description: 'Тип транзакции' 
  })
  @IsOptional()
  @IsString()
  @IsIn(['income', 'expense'])
  type?: string;

  @ApiProperty({ 
    required: false,
    description: 'ID города из references_service'
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cityId?: number;

  @ApiProperty({ 
    required: false,
    example: 'Штраф',
    description: 'Назначение платежа (фильтр)' 
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Назначение платежа не может быть длиннее 100 символов' })
  paymentPurpose?: string;

  @ApiProperty({ 
    required: false,
    example: '2024-01-01',
    description: 'Дата начала периода (YYYY-MM-DD)' 
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({ 
    required: false,
    example: '2024-12-31',
    description: 'Дата окончания периода (YYYY-MM-DD)' 
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({ 
    required: false, 
    minimum: 1,
    default: 1,
    description: 'Номер страницы для пагинации' 
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Номер страницы должен быть целым числом' })
  @Min(1, { message: 'Минимальный номер страницы: 1' })
  page?: number;

  @ApiProperty({ 
    required: false, 
    minimum: 1,
    maximum: 500,
    default: 50,
    description: 'Количество записей на странице (для статистики используйте GET /cash/stats)' 
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Лимит должен быть целым числом' })
  @Min(1, { message: 'Минимальный лимит: 1' })
  @Max(500, { message: 'Максимальный лимит: 500. Для статистики используйте GET /cash/stats' })
  limit?: number;
}

/**
 * DTO для валидации query параметров сдачи денег мастером
 */
export class GetHandoverQueryDto {
  @ApiProperty({ 
    required: false,
    enum: ['all', 'pending', 'under_review', 'approved', 'rejected'],
    default: 'all',
    description: 'Статус сдачи денег' 
  })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'pending', 'under_review', 'approved', 'rejected'])
  status?: string;

  @ApiProperty({ 
    required: false, 
    minimum: 1,
    default: 1 
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ 
    required: false, 
    minimum: 1,
    maximum: 100,
    default: 50 
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

