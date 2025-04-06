# Janken Cafe

Welcome to the online cafe project !

Visit @ https://mark-poussard.github.io/janken-cafe/

## Structure & Frameworks

This is a mono-repo containing both the backend and frontend code for Janken Cafe.

The backend is hosted on AWS Lambda through the Serverless framework and built using NodeJS and Typescript.

The frontend is hosted on Github Pages and built using React and Typescript.

## Backend

### Development Environment

Deploy the backend to a development environment on AWS.

Before anything, you will need a to have local AWS credentials setup, Serverless can guide you through the setup, please check the [documentation|https://www.serverless.com/framework/docs/providers/aws/guide/credentials#recommended-using-local-credentials]

Once AWS credentials have been setup, you might want to modify the `serverless.yml` `provider.profile` to match the credential profile (default is `serverless-admin`)

To deploy the backend to the development environment run the below
```
npm run dev
```

### Deploying to production

- Setup AWS Credentials through OIDC
- Continuous Deployment through master branch

## Frontend

### Running Locally

You will need to define a `.env.local` file at the `frontend` folder root containing your development environment backend endpoint.
```
VITE_WEBSOCKET_URL=wss://1234567890.execute-api.us-east-1.amazonaws.com/dev
```

Then run the below to start a local dev server for the frontend.
```
npm run dev
```

### Development Environment

A Continuous Deployment pipeline is setup through Github workflow to automatically deploy branches to Github Pages.

Branches are deployed to https://${ORG_NAME}.github.io/janken-cafe/branch/${BRANCH_NAME}

### Deploying to production

- Deploy backend
- Update `WEBSOCKET_URL` constant in `App.tsx` to hit the deployed production backend.

The Continuous Deployment pipeline will deploy commits to the `master` branch to https://${ORG_NAME}.github.io/janken-cafe
