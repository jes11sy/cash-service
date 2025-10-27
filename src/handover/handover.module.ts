import { Module } from '@nestjs/common';
import { HandoverController } from './handover.controller';
import { HandoverService } from './handover.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HandoverController],
  providers: [HandoverService],
  exports: [HandoverService],
})
export class HandoverModule {}
