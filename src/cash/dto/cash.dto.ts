import { IsString, IsNumber, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCashDto {
  @ApiProperty()
  @IsNumber()
  orderId: number;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiProperty({ enum: ['расход', 'предоплата', 'чистый'] })
  @IsString()
  @IsIn(['расход', 'предоплата', 'чистый'])
  type: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  receiptDoc?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdateCashDto {
  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiProperty({ required: false, enum: ['расход', 'предоплата', 'чистый'] })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  receiptDoc?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  note?: string;
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





