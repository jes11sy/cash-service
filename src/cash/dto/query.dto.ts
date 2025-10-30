import { IsOptional, IsString, IsIn, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO для валидации query параметров при получении транзакций
 */
export class GetCashQueryDto {
  @ApiProperty({ 
    required: false, 
    enum: ['приход', 'расход'],
    description: 'Тип транзакции' 
  })
  @IsOptional()
  @IsString()
  @IsIn(['приход', 'расход'])
  type?: string;

  @ApiProperty({ 
    required: false,
    description: 'Название (для обратной совместимости)',
    enum: ['приход', 'расход']
  })
  @IsOptional()
  @IsString()
  @IsIn(['приход', 'расход'])
  name?: string;

  @ApiProperty({ 
    required: false,
    example: 'Москва',
    description: 'Город' 
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Название города не может быть длиннее 100 символов' })
  city?: string;

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
    maximum: 100,
    default: 50,
    description: 'Количество записей на странице' 
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Лимит должен быть целым числом' })
  @Min(1, { message: 'Минимальный лимит: 1' })
  @Max(100, { message: 'Максимальный лимит: 100' })
  limit?: number;
}

/**
 * DTO для валидации query параметров сдачи денег мастером
 */
export class GetHandoverQueryDto {
  @ApiProperty({ 
    required: false,
    enum: ['all', 'Не отправлено', 'На проверке', 'Одобрено', 'Отклонено'],
    default: 'all',
    description: 'Статус сдачи денег' 
  })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'Не отправлено', 'На проверке', 'Одобрено', 'Отклонено'])
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

