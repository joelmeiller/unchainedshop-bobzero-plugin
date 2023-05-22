import { IPaymentAdapter, PaymentChargeActionResult } from '@unchainedshop/types/payments.js'
import { PaymentAdapter, PaymentDirector, PaymentError } from '@unchainedshop/core-payment'
import { log } from '../log.js'
import fetch from 'node-fetch'
import { LogLevel } from '@unchainedshop/logger'
// import { Context } from '@unchainedshop/types/api.js'

const { BOB_ZERO_CLIENT_CONTEXT, BOB_ZERO_API_ENDPOINT, BOB_ZERO_API_KEY } = process.env

const BASE_URL = `${BOB_ZERO_API_ENDPOINT}/BobFinancingFacadeOnboarding`

const createFinancingSession = async (params: {
  amount: number
  currency: string
  orderId: string
}): Promise<string | null> => {
  log('Bob Zero Plugin: Create financing', params)
  const financing = (await fetch(`${BASE_URL}/create_financing`, {
    method: 'POST',
    headers: {
      bobFinanceSuiteApiKey: `${BOB_ZERO_API_KEY}`,
    },
    body: JSON.stringify({
      order: {
        ref: params.orderId,
        gross_amount: params.amount || 0,
        currency: 'CHF',
      },
      payment: {
        type: 'financing',
        duration: 0,
      },
    }),
  }).then((res) => res.json())) as { financing_uid: string }

  if (!financing.financing_uid) {
    log('Bob Zero Plugin: Create session', financing)
    const financingSession = (await fetch(
      `${BASE_URL}/create_session?financing_uid=${financing.financing_uid}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          bobFinanceSuiteApiKey: `${BOB_ZERO_API_KEY}`,
        },
      },
    ).then((res) => res.json())) as {
      financing_id: number
      financing_uid: string
      financing_session_id: string
      financing_session_token: string
      issued_at: string
      expires_at: string
    }

    return financingSession.financing_session_token
  }

  return null
}

// TODO: Add (success) webhook and charge order once the application is confirmed
// export const bobZeroHandler = async (request, response) => {
//   const resolvedContext = request.unchainedContext as Context
//   const { modules } = resolvedContext

//   let financing

//   try {
//     financing = request.body
//   } catch (err) {
//     response.writeHead(400)
//     response.end(`Webhook Error: ${err.message}`)
//     return
//   }

//   try {
//     if (financing.status === 'OrderConfirmed') {
//       const orderPaymentId = financing.basket.orderId

//       await modules.orders.payments.logEvent(orderPaymentId, financing)

//       const orderPayment = await modules.orders.payments.findOrderPayment({
//         orderPaymentId,
//       })

//       const order = await modules.orders.checkout(
//         orderPayment.orderId,
//         {
//           transactionContext: {
//             financingId: financing.id,
//           },
//           paymentContext: {
//             financingId: financing.id,
//           },
//         },
//         resolvedContext,
//       )

//       logger.info(`BobZero Webhook: Unchained confirmed checkout for order ${order.orderNumber}`, {
//         orderId: order._id,
//       })
//     } else {
//       response.writeHead(404)
//       response.end()
//       return
//     }
//   } catch (err) {
//     response.writeHead(400)
//     response.end(`Webhook Error: ${err.message}`)
//     return
//   }
//   // Return a 200 response to acknowledge receipt of the event
//   response.end(JSON.stringify({ received: true }))
// }

export const BobZeroPlugin: IPaymentAdapter = {
  ...PaymentAdapter,

  key: 'shop.unchained.payment.bob_zero',
  label: 'Bob Zero',
  version: '2.0.0',

  typeSupported(type) {
    return type === 'GENERIC'
  },

  actions: (params) => {
    const { modules } = params.context

    const adapterActions = {
      ...PaymentAdapter.actions(params),

      configurationError() {
        if (!BOB_ZERO_API_KEY || !BOB_ZERO_API_ENDPOINT || !BOB_ZERO_CLIENT_CONTEXT) {
          return PaymentError.INCOMPLETE_CONFIGURATION
        }
        return null
      },

      isActive: () => {
        if (adapterActions.configurationError() === null) return true
        return false
      },

      isPayLaterAllowed() {
        return false
      },

      sign: async (transactionContext = {}) => {
        try {
          log('Bob Zero Plugin: Sign', transactionContext)
          const { order, orderPayment } = params.paymentContext
          const pricing = modules.orders.pricingSheet(order)
          const { currency, amount } = pricing.total({ useNetPrice: false })

          log('--> VALUES', { currency, amount, order })
          const session = await createFinancingSession({ currency, amount, orderId: order._id })

          if (!session) throw new Error('Bob Zero Plugin: Failed to create session')

          return session
        } catch (e) {
          log('Bob Zero Plugin: Failed', { level: LogLevel.Warning, e })
          throw new Error(e)
        }
      },

      charge: async (transactionContext = {}): Promise<false | PaymentChargeActionResult> => {
        // --> check if session is finished (success or failure)
        // --> throw error if payment failed
        // --> get order
        // --> checks if order is still valid (amount the same)
        // Return true: order paid
        // Return false: check cart remains open, no order is created yet
        return false
      },
    }

    return adapterActions
  },
}

PaymentDirector.registerAdapter(BobZeroPlugin)
