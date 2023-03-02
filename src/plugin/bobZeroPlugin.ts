import { IPaymentAdapter } from '@unchainedshop/types/payments.js'
import { PaymentAdapter, PaymentDirector, PaymentError } from '@unchainedshop/core-payment'
import { createLogger } from '@unchainedshop/logger'
import fetch from 'node-fetch'

const logger = createLogger('unchained:core-payment:bob-zero')

const { BOB_ZERO_CLIENT_CONTEXT, BOB_ZERO_API_ENDPOINT, BOB_ZERO_API_KEY } = process.env

const BASE_URL = `${BOB_ZERO_API_ENDPOINT}/BobFinancingFacadeOnboarding`

const createFinancingSession = async (params: {
  amount: number
  currency: string
  orderId: string
}): Promise<string | null> => {
  logger.log('Bob Zero Plugin: Create financing', params)
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
    logger.log('Bob Zero Plugin: Create session', financing)
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
          logger.log('Bob Zero Plugin: Sign', transactionContext)
          const { order, orderPayment } = params.paymentContext
          const pricing = modules.orders.pricingSheet(order)
          const { currency, amount } = pricing.total({ useNetPrice: false })

          const session = await createFinancingSession({ currency, amount, orderId: order._id })

          if (!session) throw new Error('Bob Zero Plugin: Failed to create session')

          return session
        } catch (e) {
          logger.warn('Bob Zero Plugin: Failed', e)
          throw new Error(e)
        }
      },
    }

    return adapterActions
  },
}

PaymentDirector.registerAdapter(BobZeroPlugin)
