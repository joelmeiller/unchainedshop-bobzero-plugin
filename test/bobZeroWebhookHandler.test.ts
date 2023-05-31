import { assert } from 'chai'
import sinon from 'sinon'

import { BobZeroWebhookHandler } from '../lib/index'
import { BobZeroFinancing, BobZeroStatus } from '../lib/types'

const DefaultFinancing: BobZeroFinancing = {
  status: {
    ext_status: BobZeroStatus.WebhookSuccessfulFinancing,
    ext_error_code: 'None',
    link_id_verification: null,
    link_contract_signing: null,
  },
  financing_id: 158,
  financing_uid: 'd59088fc-9077-4f6d-92ab-50c57af0e59b',
  sale: {
    agent: null,
    ga_client_id: null,
    ga_session_id: null,
    ga_gcl_id: null,
  },
  order: {
    ref: '123456',
    title: 'Financing Order',
    description: 'Bob Zero Financing Order',
    net_amount: 0.0,
    vat_amount: 0.0,
    gross_amount: 8500.0,
    currency: 'CHF',
    items: [],
  },
  payment: {
    type: 'financing',
    duration: 6,
    retainer_amount: 0.0,
    has_ppi: false,
  },
  quote: {
    lower_monthly_installment_amount: 0.0,
    lower_annual_interest_rate: 0.0,
    lower_monthly_insurance_cost: 0.0,
    upper_monthly_installment_amount: 0.0,
    upper_annual_interest_rate: 0.0,
    upper_monthly_insurance_cost: 0.0,
  },
  customer: {
    subscribe_to_bob_marketing: false,
    firstname: 'Bob',
    lastname: 'Zero Test',
    gender: 'Male',
    date_of_birth: '1981-12-09',
    email: 'bob@bob.ch',
    phone: '+41772221111',
    language: 'en',
    nationality: 'che',
    permit_type: null,
    permit_valid_until: null,
    living_in_switzerland_since: null,
    addresses: [
      {
        type: 'actual',
        street: 'Teststrasse',
        house_nr: '111',
        city: 'Bern',
        zip: '3003',
        region: null,
        country: 'ch',
        country3: 'che',
      },
    ],
  },
  additional_data: [],
}

const logEvent = sinon.stub()
const findOrderPayment = sinon.stub().resolves({
  orderId: '123',
})
const checkout = sinon.stub().resolves({
  _id: '123',
  orderNummer: 'Bob-Zero-Order-123',
})

const DefaultReq = {
  method: 'POST',
  headers: {
    authorization: 'Basic test-webhook-key-1234',
  },
  unchainedContext: {
    modules: {
      orders: {
        checkout,
        payments: {
          logEvent,
          findOrderPayment,
        },
      },
    },
  },
}

const DefaultRes = {
  writeHead: sinon.stub(),
  next: sinon.stub(),
  end: sinon.stub(),
}

describe('BobZeroWebhookHandler', () => {
  beforeEach(() => {
    logEvent.resetHistory()
    findOrderPayment.resetHistory()
    checkout.resetHistory()
    
    Object.keys(DefaultRes).forEach((key) => {
      DefaultRes[key].resetHistory()
    })
  })

  it('success webhook', async () => {
    const req = {
      ...DefaultReq,
      body: DefaultFinancing,
    }

    await BobZeroWebhookHandler(req, DefaultRes)

    assert.isTrue(DefaultRes.end.calledOnce)
    assert.isTrue(DefaultRes.end.calledWith(JSON.stringify({ received: true })))

    assert.isTrue(findOrderPayment.calledOnce, 'findOrderPayment called once')
    assert.isTrue(
      findOrderPayment.calledWith({ orderPaymentId: '123456' }),
      'findOrderPayment called with orderPaymentId',
    )

    assert.isTrue(checkout.calledOnce, 'order checkout called once')
    assert.isTrue(checkout.calledWith('123'), 'order checkout called with orderId')
  })

  it('error webhook', () => {
    // const BobZeroWebhookHandler = BobZeroWebhookHandler()
    //   config: [],
    //   context: {} as any,
    //   paymentContext: {} as any,
    // })
    // assert.isTrue(BobZeroWebhookHandler.isActive())
  })

  it('webhook called with unknown state', async () => {
    const req = {
      ...DefaultReq,
      body: {
        ...DefaultFinancing,
        status: {
          ...DefaultFinancing.status,
          ext_status: 'Unknown',
      },
      }
    }

    await BobZeroWebhookHandler(req, DefaultRes)

    assert.isTrue(DefaultRes.end.calledOnce)
    assert.isTrue(DefaultRes.end.calledWith(JSON.stringify({ received: true })))
  
    assert.isTrue(findOrderPayment.notCalled, 'findOrderPayment not called')
    assert.isTrue(checkout.notCalled, 'order checkout not called')
  })

  it('not authorized', async () => {
    const req = {
      ...DefaultReq,
      headers: {
        authorization: 'Basic invalid-test-webhook-key-9999',
      },
      body: {
        ...DefaultFinancing,
        status: {
          ...DefaultFinancing.status,
          ext_status: 'Unknown',
        },
      },
    }
    
    await BobZeroWebhookHandler(req, DefaultRes)

    assert.isTrue(DefaultRes.end.calledOnce)
    assert.isTrue(DefaultRes.writeHead.calledWith(401))
    assert.isTrue(DefaultRes.end.calledWith('Request not authorized'))
  })
})
