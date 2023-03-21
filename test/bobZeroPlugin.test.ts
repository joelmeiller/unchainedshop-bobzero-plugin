import { assert } from 'chai'
import { BobZeroPlugin } from '../src/index'

describe('bobZeroPlugin', () => {
  it('should create a financing session', () => {
    const bobZeroPlugin = BobZeroPlugin.actions({
      config: [],
      context: {} as any,
      paymentContext: {} as any,
    })

    assert.isTrue(bobZeroPlugin.isActive())
  })
})
