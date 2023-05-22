import { Context } from '@unchainedshop/types/api.js'
import { log } from '../log.js'
import { BobZeroFinancing } from '../types.js'

// TODO: Add (success) webhook and charge order once the application is confirmed
export const BobZeroWebhookHandler = async (request, response) => {
  const resolvedContext = request.unchainedContext as Context
  const { modules } = resolvedContext

  let financing: BobZeroFinancing | null = null

  try {
    financing = request.body as BobZeroFinancing
  } catch (err) {
    response.writeHead(400)
    response.end(`Webhook Error: ${err.message}`)
    return
  }

  try {
    if (financing.status.ext_status === 'WebhookSuccessfulFinancing') {
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
