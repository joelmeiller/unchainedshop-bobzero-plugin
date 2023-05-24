import { IPaymentAdapter, PaymentChargeActionResult } from '@unchainedshop/types/payments.js'
import { PaymentAdapter, PaymentDirector, PaymentError } from '@unchainedshop/core-payment'
import { log } from '../log.js'
import fetch from 'node-fetch'
import { LogLevel } from '@unchainedshop/logger'
import { BobZeroFinancing, BobZeroSession, BobZeroStatus } from '../types.js'
import { Order, OrdersModule } from '@unchainedshop/types/orders.js'

const { BOB_ZERO_CLIENT_CONTEXT, BOB_ZERO_API_ENDPOINT, BOB_ZERO_API_KEY } = process.env

const BOB_ZERO_API_BASE_URL = `${BOB_ZERO_API_ENDPOINT}/BobFinancingFacadeOnboarding`
const BOB_ZERO_API_HEADERS = {
  bobFinanceSuiteApiKey: `${BOB_ZERO_API_KEY}`,
}

const createFinancingSession = async (params: {
  amount: number
  currency: string
  language: string
  order: Order
  orderReference: string
  redirectUrl?: string
}): Promise<BobZeroSession | null> => {
  log('Create financing', params)

  const body = {
    order: {
      ref: params.orderReference,
      gross_amount: params.amount || 0,
      currency: 'CHF',
    },
    payment: {
      type: 'financing',
      duration: 0,
    },
    sale: {
      webshop_return_url: params.redirectUrl,
    },
    customer: {
      language: params.language,
      firstname: params.order.billingAddress?.firstName || null,
      lastname: params.order.billingAddress?.lastName || null,
      email: params.order.contact?.emailAddress,
      phone: null,
      nationality: null,
      addresses: params.order.billingAddress
        ? [
            {
              type: 'actual',
              street: params.order.billingAddress.addressLine,
              house_nr: null,
              city: params.order.billingAddress.city,
              zip: params.order.billingAddress.postalCode,
              region: null,
              country: params.order.billingAddress.countryCode,
              country3: null,
            },
          ]
        : [],
    },
  }

  log('Financing -> Body', body)

  const financing = (await fetch(`${BOB_ZERO_API_BASE_URL}/create_financing`, {
    method: 'POST',
    headers: BOB_ZERO_API_HEADERS,
    body: JSON.stringify(body),
  }).then((res) => res.json())) as BobZeroFinancing

  if (financing.financing_uid) {
    log('Bob Zero Plugin: Create session', {
      url: `${BOB_ZERO_API_BASE_URL}/create_session?financing_uid=${financing.financing_uid}`,
    })
    const financingSession = (await fetch(
      `${BOB_ZERO_API_BASE_URL}/create_session?financing_uid=${financing.financing_uid}`,
      {
        method: 'GET',
        headers: BOB_ZERO_API_HEADERS,
      },
    ).then((res) => res.json())) as BobZeroSession

    return financingSession
  }

  return null
}

const checkIsPaid = (order: Order, orderModule: OrdersModule, financing: BobZeroFinancing): boolean => {
  const pricing = orderModule.pricingSheet(order)
  const totalAmount = pricing.total({ useNetPrice: false }).amount

  log('Check is paid', { financingAmount: financing.order.gross_amount, totalAmount,  })
  return (
    financing.order.gross_amount && financing.order.gross_amount.toFixed(2) === totalAmount.toFixed(2)
  )
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

      sign: async (transactionContext = { language: 'de', redirectUrl: null }) => {
        try {
          log('Sign', transactionContext)
          const { order, orderPayment } = params.paymentContext
          const pricing = modules.orders.pricingSheet(order)
          const { currency, amount } = pricing.total({ useNetPrice: false })

          const session = await createFinancingSession({
            amount,
            currency,
            language: transactionContext.language,
            orderReference: orderPayment._id,
            order,
            redirectUrl: transactionContext.redirectUrl,
          })

          if (!session) throw new Error('Bob Zero Plugin: Failed to create session')

          return JSON.stringify(session)
        } catch (e) {
          log('Signing failed', { level: LogLevel.Warning, e })
          throw new Error(e)
        }
      },

      // Return true: order paid
      // Return false: check cart remains open, no order is created yet
      charge: async (
        transactionContext: BobZeroFinancing | null,
      ): Promise<false | PaymentChargeActionResult> => {
        log('Charge', transactionContext)
        // --> check if session is finished (success or failure)
        if (!transactionContext?.financing_id) return false

        // --> throw error if payment failed
        if (transactionContext.status.ext_status !== BobZeroStatus.WebhookSuccessfulFinancing)
          return false

        // --> get order
        if (!params.paymentContext.order) return false
        const order = params.paymentContext.order

        // --> checks if order is still valid (amount the same)
        const isPaid = checkIsPaid(order, modules.orders, transactionContext)
        if (!isPaid) {
          return false
        }

        return {
          transactionId: `${transactionContext.financing_id}`,
        }
      },
    }

    return adapterActions
  },
}

PaymentDirector.registerAdapter(BobZeroPlugin)
