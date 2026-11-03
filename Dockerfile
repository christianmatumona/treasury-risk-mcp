# Runs the published npm package. No wallet key is baked in: without X402_PRIVATE_KEY the
# server starts in free mode (tools are listed; paid tools validate input and quote the price).
FROM node:20-alpine
RUN npm install -g treasury-risk-mcp@0.1.2 && npm cache clean --force
ENV MAX_PAYMENT_USD=2.00
USER node
ENTRYPOINT ["treasury-risk-mcp"]
