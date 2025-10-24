import { IsString, IsNumber, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCashDto {
  @ApiProperty({ enum: ['приход', 'расход'] })
  @IsString()
  @IsIn(['приход', 'расход'])
  name: string;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  receiptDoc?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  paymentPurpose?: string;
}

export class UpdateCashDto {
  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
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

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  receiptDoc?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
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














