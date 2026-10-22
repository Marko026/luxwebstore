# luxwebstore

An online shop for a small catalogue of luxury bags.

## Language

### People

**Guest**:
Someone using the shop without being signed in.
_Avoid_: Anonymous user, visitor, shopper

**User**:
Someone signed in to an account in the shop.
_Avoid_: Account, member, shopper

**Customer**:
Someone who has placed an order. A Guest can be a Customer too, known by the email they gave at Checkout. Not every User is a Customer.
_Avoid_: Buyer, client

### Buying

**Bag**:
The products a Guest or User has chosen to buy, before checkout. It holds no Stock and no price of its own: it always shows the current catalogue price.
_Avoid_: Cart, basket, shopping cart

**Bag item**:
One product in a Bag, with how many of it are wanted.
_Avoid_: Line, cart item, entry

**Stock**:
The number of units of a product that can be ordered online right now. Adding a product to a Bag does not take it out of Stock; starting a Checkout does.
_Avoid_: Inventory, availability

**Subtotal**:
What a Bag costs together at current catalogue prices, VAT included. A sold-out Bag item is left out; a Bag item with more units than are left in Stock still counts at its full quantity, so lowering it is the Guest's or User's own choice.
_Avoid_: Order total, grand total

**Checkout**:
One attempt to pay for a Bag. It starts only when every Bag item is in Stock at its full quantity, takes those units out of Stock and fixes their prices. It can be paid for 30 minutes; after that it can no longer be paid and its units go back to Stock, though not necessarily at that same moment. A Guest or User has at most one open Checkout: starting another closes the earlier one and returns its units. Going back from paying closes it at once. While it is open, its owner's own Bag still counts its units as theirs, so leaving the payment page without Stripe's back link never blocks them from starting again.
_Avoid_: Payment session, pending order

**Order**:
What a Customer has bought and paid for. An Order exists only once its Checkout is paid; until then there is no Order. It keeps its own email and delivery address, so it outlives a Guest who is deleted. It belongs to the Guest or User who paid for it; when a Guest signs in or signs up, their Orders become that User's, whatever email the account has. A Guest deleted before signing in leaves their Orders with no owner.
_Avoid_: Purchase, sale

**Order number**:
The short number a Customer uses to refer to their Order, such as LUX-10042.
_Avoid_: Order ID

**Order item**:
One product in an Order, with how many were bought, the price each was bought at and the product's name at that time. Later catalogue changes do not touch it, and a product that has been ordered is never deleted.
_Avoid_: Order line
