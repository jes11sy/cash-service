# Cash Service

Микросервис для управления финансами (Cash transactions, Master handover).

## Функционал

### Cash Transactions
- Создание заявок на сдачу денег
- Утверждение/отклонение заявок директорами
- Просмотр баланса мастера
- Загрузка чеков

### Master Handover
- Создание периодических сдач (daily, weekly, monthly)
- Отправка на утверждение
- Утверждение директорами

## API Endpoints

### Cash
- `GET /api/v1/cash` - Получить все транзакции
- `POST /api/v1/cash` - Создать транзакцию
- `PATCH /api/v1/cash/:id/approve` - Утвердить/отклонить
- `GET /api/v1/cash/balance/:masterId` - Баланс мастера

### Handover
- `GET /api/v1/handover` - Получить все сдачи
- `POST /api/v1/handover` - Создать сдачу
- `PATCH /api/v1/handover/:id/submit` - Отправить на утверждение
- `PATCH /api/v1/handover/:id/approve` - Утвердить/отклонить

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=your-secret
PORT=5006
```

## Docker

```bash
docker build -t cash-service .
docker run -p 5006:5006 cash-service
```




















