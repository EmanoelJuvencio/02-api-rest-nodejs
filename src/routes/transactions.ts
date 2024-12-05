import { FastifyInstance } from 'fastify'
import { knex } from '../../db/database'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { checkSessionIdExist } from '../middlewares/check-session-id-exist'

export async function transactionsRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    try {
      const createTransactionBodySchema = z.object({
        title: z.string(),
        amount: z.number(),
        type: z.enum(['credit', 'debit']),
      })

      const { title, amount, type } = createTransactionBodySchema.parse(
        request.body
      )

      let sessionId = request.cookies.sessionId

      if (!sessionId) {
        sessionId = randomUUID()
        reply.cookie('sessionId', sessionId, {
          path: '/',
          maxAge: 60 * 60 * 24 * 7, // 7 Dias
        })
      }

      await knex('transactions').insert({
        id: randomUUID(),
        title,
        amount: type === 'credit' ? amount : amount * -1,
        session_id: sessionId,
      })

      return reply.status(201).send()
    } catch (error) {
      return reply.status(400).send(JSON.parse(error as string))
    }
  })

  app.get('/', { preHandler: [checkSessionIdExist] }, async (request) => {
    const { sessionId } = request.cookies

    const transactions = await knex('transactions')
      .where('session_id', sessionId)
      .select()

    return { transactions }
  })

  app.get('/:id', { preHandler: [checkSessionIdExist] }, async (request) => {
    const getTransactionsParamsSchema = z.object({
      id: z.string().uuid(),
    })

    const { sessionId } = request.cookies
    const { id } = getTransactionsParamsSchema.parse(request.params)

    const transaction = await knex('transactions')
      .where({
        id: id,
        session_id: sessionId,
      })
      .first()

    return { transaction }
  })

  app.get(
    '/summary',
    { preHandler: [checkSessionIdExist] },
    async (request) => {
      const { sessionId } = request.cookies

      const summary = await knex('transactions')
        .where('session_id', sessionId)
        .sum('amount', { as: 'amount' })
        .first()

      return { summary }
    }
  )
}
