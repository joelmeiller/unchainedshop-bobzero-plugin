import { Context } from '@unchainedshop/types/api.js'
import { log } from '../log.js'
import { BobZeroFinancing, BobZeroStatus } from '../types.js'

const { BOB_ZERO_WEBHOOK_KEY } = process.env

export const BobZeroWebhookHandler = async (request, response) => {
  // Check header
  const { Authorization } = request.headers
  if (Authorization !== `Basic ${BOB_ZERO_WEBHOOK_KEY}`) {
    response.writeHead(401)
    response.end(`Request not authorized`)
    return
  }

  // Get Unchained context
  const resolvedContext = request.unchainedContext as Context
  const { modules } = resolvedContext

  let financing: BobZeroFinancing | null = null

  // Get financing from bob zero request
  try {
    financing = request.body as BobZeroFinancing
  } catch (err) {
    response.writeHead(400)
    response.end(`Webhook Error: ${err.message}`)
    return
  }

  // Update order payment 
  try {
    if (financing.status.ext_status === BobZeroStatus.WebhookSuccessfulFinancing) {
      const orderPaymentId = financing.order.ref

      await modules.orders.payments.logEvent(orderPaymentId, financing)

      const orderPayment = await modules.orders.payments.findOrderPayment({
        orderPaymentId,
      })

      const order = await modules.orders.checkout(
        orderPayment.orderId,
        {
          transactionContext: {
            financingId: financing.financing_id,
          },
          paymentContext: {
            financingId: financing.financing_id,
          },
        },
        resolvedContext,
      )

      log(`BobZero Webhook: Unchained confirmed checkout for order ${order.orderNumber}`, {
        orderId: order._id,
      })
    }
    // TODO: Add failure webhook and others
  } catch (err) {
    response.writeHead(400)
    response.end(`Webhook Error: ${err.message}`)
    return
  }
  // Return a 200 response to acknowledge receipt of the event
  response.end(JSON.stringify({ received: true }))
}
