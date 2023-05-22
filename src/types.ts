export type BobZeroSession = {
  financing_id: number
  financing_uid: string
  financing_session_id: string
  financing_session_token: string
  redirect_url: string
  issued_at: string
  expires_at: string
}

export enum BobZeroStatus {
  WebhookLinkForIdVerification = 'WebhookLinkForIdVerification',
  WebhookIDVerificationCompleted = 'WebhookIDVerificationCompleted',
  WebhookPaymentPlanConfirmed = 'WebhookPaymentPlanConfirmed',
  WebhookSuccessfulFinancing = 'WebhookSuccessfulFinancing',
} 

export type BobZeroFinancing = {
  status: {
    ext_status: BobZeroStatus
    ext_error_code: string
    link_id_verification: null | string
    link_contract_signing: null | string
  }
  financing_id: number
  financing_uid: string
  sale: {
    agent: null
    ga_client_id: null
    ga_session_id: null
    ga_gcl_id: null
  }
  order: {
    ref: string
    title: string
    description: string
    net_amount: number
    vat_amount: number
    gross_amount: number
    currency: 'CHF'
    items: Array<{
      ref: null
      title: string
      quantity: number
      net_amount: number
      vat_amount: number
      gross_amount: number
    }>
  }
  payment: {
    type: 'financing'
    duration: number
    retainer_amount: number
    has_ppi: boolean
  }
  quote: {
    lower_monthly_installment_amount: number
    lower_annual_interest_rate: number
    lower_monthly_insurance_cost: number
    upper_monthly_installment_amount: number
    upper_annual_interest_rate: number
    upper_monthly_insurance_cost: number
  }
  customer: {
    subscribe_to_bob_marketing: false
    firstname: string
    lastname: string
    gender: string
    date_of_birth: string
    email: string
    phone: string
    language: 'en' | 'de' | 'fr' | 'it'
    nationality: string
    permit_type: null
    permit_valid_until: null
    living_in_switzerland_since: null
    addresses: Array<{
      type: 'actual' | 'old'
      street: string
      house_nr: string
      city: string
      zip: string
      region: null
      country: string
      country3: string
    }>
  }
  additional_data: Array<unknown>
}
