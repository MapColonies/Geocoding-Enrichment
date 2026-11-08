# Geocoding-Enrichment
This service provides enrichment of the data that comes from MapColonie's [geocoding service](https://github.com/MapColonies/Geocoding), and saves the enriched data to elastic for BI purposes.

## API
Checkout the OpenAPI spec [here](/openapi3.yaml)

## Workflow
![Workflow Image](https://github.com/user-attachments/assets/0152dcb5-ece7-42a2-b630-116eaec6181d)

## How does it work?
Once the requesting system sends the `request_id`, the `chosen_response_id`, and the `user_id` of the user who used [Geocoding](https://github.com/MapColonies/Geocoding) back to us using [Feedback api](https://github.com/MapColonies/feedback-api), that response is then combined with Geocoding's response and sent to Kafka, which then is consumed by Geocoding-enrichment.</br> 
When the response reaches geocoding-enrichment, the service then attaches the `chosen_response_id` to the geocoding response to see what response the user selected.</br>
In addition to adding some data to the response, The service also uses the userData service in order to fetch the user's data and see who uses Geocoding.</br>
Once the data is enriched, it is stored in Elasticsearch which is connected to a Grafana Dashboard in order to be analyzed. 

## UserData Service:
We use an external ADFS in order to extract user details from the userId. Here is a mock service that will preduce the somewhat expected response from the userData Service.
```
const express = require('express');

const app = express();
app.set('port', 5000);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get("/user_data/:userid", (req, res) => {
  console.log("new request", req.params, req.query);
  const { userid } = req.params;
  const users = {
    "avi@mapcolonies.net": {
      firstName: "avi",
      lastName: "map",
      displayName: "mapcolonies/avi",
      mail: "avi@mapcolonies.net",
      domains: ["USA", "FRANCE"],
    },
  };
  const user = users[userid] ? users[userid] : { [userid]: null };
  return res.status(200).json(user);
});

app.listen(app.get('port'), () => {
	console.log(`Server is running on port ${app.get('port')}`);
});
```

## Installation

Install deps with npm

```bash
npm install
```
### Install Git Hooks
```bash
npx husky install
```

## Run Locally

Clone the project

```bash

git clone https://github.com/MapColonies/Geocoding-Enrichment.git
```

Go to the project directory

```bash

cd geocoding-enrichment

```

Install dependencies

```bash

npm install

```

Start the server

```bash

npm run start

```

## Debugging Locally

In production, [feedback-api](https://github.com/MapColonies/feedback-api) is the service that produces the Kafka message this service consumes: it combines the feedback it receives (`request_id`, `chosen_response_id`, `user_id`) with Geocoding's original response and publishes the result to the `kafkaTopics.input` topic. `StreamerBuilder` ([src/streamerBuilder.ts](src/streamerBuilder.ts)) is the consumer on the other end — it's the thing being debugged here.

To exercise that consumer locally without running feedback-api or waiting for real traffic, [scripts/debug-kafka-consumer.ts](scripts/debug-kafka-consumer.ts) stands in for feedback-api: it produces a FeedbackResponse payload, shaped exactly like what feedback-api sends, straight to a local Kafka broker.

1. Start the dependencies (Kafka, Elasticsearch, the userData mock, and Jaeger for tracing):
   ```bash
   docker compose up kafka kafka-init elasticsearch user-data-service jaeger
   ```
2. Run the service in dev mode. `npm run start:dev` already points at this docker-compose stack (Kafka's host-reachable `localhost:9094` listener, Elasticsearch on `localhost:9200`, the mock user-data-service on `localhost:5000`, and tracing exported to Jaeger at `localhost:4318`) — see the `start:dev` script in [package.json](package.json) if you need to point it elsewhere:
   ```bash
   npm run start:dev
   ```
3. Produce a message, standing in for feedback-api:
   ```bash
   npm run debug:produce-kafka
   ```

`docker-compose.yaml`'s Kafka broker advertises that host-reachable listener on port `9094` (in addition to the in-network `kafka:9092` one) so the service and the script can run outside docker while talking to it. See [scripts/debug-kafka-consumer.ts](scripts/debug-kafka-consumer.ts) for passing a custom payload file (e.g. one captured from production) instead of the bundled sample, or `--new-request-id` to replay the same payload without colliding on request ids.

Once consumed, the enriched record lands in Elasticsearch (`curl localhost:9200/enrich_index/_search`) and the full trace — Kafka handling, the user-data lookup, and the Elasticsearch write — is viewable in the Jaeger UI at http://localhost:16686.

## Running Tests

To run tests, run the following command

```bash

npm run test

```

To only run unit tests:
```bash
npm run test:unit
```

To only run integration tests:
```bash
npm run test:integration
```

## Deploy to azure

```bash
docker build . --tag acrarolibotnonprod.azurecr.io/geocoding-enrichment:v1.7.0-rc2
docker push acrarolibotnonprod.azurecr.io/geocoding-enrichment:v1.7.0-rc2
```

go to https://github.com/MapColonies/vector-helms/tree/master/geocoding-helms/charts/geocoding-enrichment
update image in values and run:

```
helm upgrade --install vector-geocoding -f azure.dev.yaml . -n vector-dev
```
