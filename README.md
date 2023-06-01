# unchainedshop-bobzero-plugin
Plugin for unchained engine to support payments with the bob zero ecommerce product of bob Finance AG.

## Setup

### Environment configuration

The following values need be set as ENV variables in your unchained engine.

| Env Variable | Description |
| - | - |
| BOB_ZERO_API_ENDPOINT | bob Zero endpoint to connect. The correct URLs can be found in the bob partner dashboard once you have a login. Usually the url looks something like this https://api.bob.ch for production and https://api.stage.bob.ch for the sandbox test environment |
| BOB_ZERO_API_KEY | The api key that has will be passed as bob zero specific header _bobFinanceSuiteApiKey_ when calling the endpoints. Our specific key can be found in the bob partner dashboard |
| BOB_ZERO_WEBHOOK_KEY | The authorization header that is set for all incoming webhooks from bob zero. The plugin checks for a correct authorization header before processing the webhook call. Our specific key can be found in the bob partner dashboard. |

## Add webhook handler 

Add the marked code to the _boot.ts_ file of your engine.

```javascript
...

// ### BOB ZERO PLUGIN - START ### --> REQUIRED IMPORTS
import { BobZeroWebhookHandler } from 'unchainedshop-bobzero-plugin'
import { useMiddlewareWithCurrentContext } from '@unchainedshop/api/express/index.js'
// ### BOB ZERO PLUGIN - END ###


// ### BOB ZERO PLUGIIN - START ### --> WEBHOOK PATH
const BOB_ZERO_WEBHOOK_PATH = '/payment/bobzero/webhook'
// ### BOB ZERO PLUGIIN - END ###


const start = async () => {
  const app = express()

  ...

  // Start the GraphQL Server
  await engine.apolloGraphQLServer.start()

  connectPlatformToExpress4(app, engine)

  // ### BOB ZERO PLUGIIN - START ### --> WEBHOOK HANDLER CODE

  // Connect bob zero webhook handler
  useMiddlewareWithCurrentContext(
    app,
    BOB_ZERO_WEBHOOK_PATH,
    express.json(),
    BobZeroWebhookHandler,
  )

  // ### BOB ZERO PLUGIIN - END ###

  connectDefaultPluginsToExpress4(app, engine)

```