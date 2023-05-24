import { Context } from '@unchainedshop/types/api.js'
import { log } from '../log.js'
import { BobZeroFinancing, BobZeroStatus } from '../types.js'
import { LogLevel } from '@unchainedshop/logger'

const { BOB_ZERO_WEBHOOK_KEY } = process.env

export const BobZeroWebhookHandler = async (request, response) => {
  // Check header
  const authorizationHeader = request.headers['authorization']
  log('REQUEST', { headers: request['headers'], authorizationHeader, method: request.method })
  if (request.method === 'POST' && authorizationHeader) {
    if (authorizationHeader !== `Basic ${BOB_ZERO_WEBHOOK_KEY}`) {
      log('Unauthorized webhook request', { level: LogLevel.Error, authorizationHeader })
      response.writeHead(401)
      response.end(`Request not authorized`)
      return
    }

    // Get Unchained context
    const resolvedContext = request.unchainedContext as Context
    const { modules } = resolvedContext

    let financing: BobZeroFinancing | null = null

    // Update order payment
    try {
      financing = request.body as BobZeroFinancing

      if (financing.status.ext_status === BobZeroStatus.WebhookSuccessfulFinancing) {
        const orderPaymentId = financing.order.ref

        await modules.orders.payments.logEvent(orderPaymentId, financing)

        const orderPayment = await modules.orders.payments.findOrderPayment({
          orderPaymentId,
        })

        const order = await modules.orders.checkout(
          orderPayment.orderId,
          {
            transactionContext: financing,
            paymentContext: {
              transactionId: financing.financing_id,
            },
          },
          resolvedContext,
        )

        log(`Unchained confirmed checkout for order ${order.orderNumber} (webhook)`, {
          orderId: order._id,
        })
      }
      // TODO: Add failure webhook and others
    } catch (error) {
      log('Webhook request error', { level: LogLevel.Error, error })

      response.writeHead(400)
      response.end(`Webhook Error: ${error.message}`)
      return
    }
  } else {

  }

  // Return a 200 response to acknowledge receipt of the event
  response.end(JSON.stringify({ received: true }))
}
