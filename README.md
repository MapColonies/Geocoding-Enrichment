# Geocoding-Enrichment
This service provides enrichment of the data that comes from MapColonie's [geocoding service](https://github.com/MapColonies/Geocoding), and saves the enriched data to elastic for BI purposes.

## API
Checkout the OpenAPI spec [here](/openapi3.yaml)

## Workflow
![Workflow Image](https://github.com/user-attachments/assets/0152dcb5-ece7-42a2-b630-116eaec6181d)

## How does it work?
Once the requesting system sends the `request_id`, the `chosen_response_id`, and the `user_id` of the user who used [Geocoding](https://github.com/MapColonies/Geocoding) back to us using [Feedback api](https://github.com/MapColonies/feedback-api), that response is then combined with Geocoding's response and sent to Kafka, which then is consumed by Geocoding-enrichment.</br> 
Once the response reaches geocoding-enrichment, the service then attaches the `chosen_response_id` to the geocoding response to see what response the user selected.</br>
In addition to adding some data to the response, The service also uses the userData service in order to fetch the user's data and see who uses Geocoding.</br>
Once the data is enriched, it is stored in Elasticsearch which is connected to a Grafana Dashboard in order to be analyzed. 

## UserData Service:
We use 3rd party software in order to extract user details from the userId. Here is a mock service that will preduce the somewhat expected response from the userData Service.
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
