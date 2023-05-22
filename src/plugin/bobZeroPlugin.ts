import { IPaymentAdapter, PaymentChargeActionResult } from '@unchainedshop/types/payments.js'
import { PaymentAdapter, PaymentDirector, PaymentError } from '@unchainedshop/core-payment'
import { log } from '../log.js'
import fetch from 'node-fetch'
import { LogLevel } from '@unchainedshop/logger'
import { BobZeroFinancing, BobZeroSession } from '../types.js'

const { BOB_ZERO_CLIENT_CONTEXT, BOB_ZERO_API_ENDPOINT, BOB_ZERO_API_KEY } = process.env

const BASE_URL = `${BOB_ZERO_API_ENDPOINT}/BobFinancingFacadeOnboarding`

const createFinancingSession = async (params: {
  amount: number
  currency: string
  language: string
  orderReference: string
}): Promise<BobZeroSession | null> => {
  log('Bob Zero Plugin: Create financing', params)
  const financing = (await fetch(`${BASE_URL}/create_financing`, {
    method: 'POST',
    headers: {
      bobFinanceSuiteApiKey: `${BOB_ZERO_API_KEY}`,
    },
    body: JSON.stringify({
      order: {
        ref: params.orderReference,
        gross_amount: params.amount || 0,
        currency: 'CHF',
      },
      payment: {
        type: 'financing',
        duration: 0,
      },
      customer: {
        language: params.language,
      },
    }),
  }).then((res) => res.json())) as BobZeroFinancing

  if (financing.financing_uid) {
    log('Bob Zero Plugin: Create session', {
      url: `${BASE_URL}/create_session?financing_uid=${financing.financing_uid}`,
    })
    const financingSession = (await fetch(
      `${BASE_URL}/create_session?financing_uid=${financing.financing_uid}`,
      {
        method: 'GET',
        headers: {
          bobFinanceSuiteApiKey: `${BOB_ZERO_API_KEY}`,
        },
      },
    ).then((res) => res.json())) as BobZeroSession

    return financingSession
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

      sign: async (transactionContext = { language: 'de' }) => {
        try {
          log('Bob Zero Plugin: Sign', transactionContext)
          const { order, orderPayment } = params.paymentContext
          const pricing = modules.orders.pricingSheet(order)
          const { currency, amount } = pricing.total({ useNetPrice: false })

          const session = await createFinancingSession({
            amount,
            currency,
            language: transactionContext.language,
            orderReference: orderPayment._id,
          })

          if (!session) throw new Error('Bob Zero Plugin: Failed to create session')

          return JSON.stringify(session)
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
