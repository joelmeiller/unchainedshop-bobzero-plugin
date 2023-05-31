import { assert } from 'chai'
import { BobZeroPlugin } from '../lib/index'

describe('bobZeroPlugin', () => {
  it('can instantiate actions', () => {
    const bobZeroPlugin = BobZeroPlugin.actions({
      config: [],
      context: {} as any,
      paymentContext: {} as any,
    })

    assert.isFalse(bobZeroPlugin.isActive())
  })
})
