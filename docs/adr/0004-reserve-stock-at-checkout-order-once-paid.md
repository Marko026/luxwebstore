# Stock is reserved when a Checkout starts; an Order exists only once paid

Payment runs on Stripe's hosted Checkout page, and we learn it succeeded from Stripe, not from the browser. Our products have one to three units each, so two Customers paying for the last unit at once is a real case. So starting a Checkout takes its units out of Stock and fixes their prices for 30 minutes, and an Order is created only when the Checkout is paid. A Checkout that is not paid, is replaced by a newer one, or is left with Stripe's back link gives its units back.

## Considered Options

- **Take units out of Stock only after payment, refund if sold out meanwhile**: rejected. A Customer who has paid would be told afterwards that their bag is gone; with so few units that would not be rare.
- **A "pending" Order created when Checkout starts**: rejected. "Order" would then mean "maybe paid", and abandoned payments would fill the Orders. The Checkout holds the reservation instead.
- **Stripe Payment Element on our own page**: deferred. More code and states to handle; the hosted page is enough for now and can be swapped later.

## Consequences

- Someone who abandons a Checkout holds its units for up to 30 minutes.
- Units come back on Stripe's expiry event and also from a sweep of Checkouts older than 30 minutes, so a missed event does not leak Stock.
- The Order is created by one idempotent step, called from both Stripe's webhook and the confirmation page; what was bought and at what price comes from our Checkout, not from Stripe's line items.
