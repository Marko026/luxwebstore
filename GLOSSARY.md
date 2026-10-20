# luxwebstore

An online shop for a small catalogue of luxury bags.

## Language

### People

**Guest**:
Someone using the shop without being signed in.
_Avoid_: Anonymous user, visitor

**User**:
Someone signed in to an account in the shop.
_Avoid_: Account, member

**Customer**:
Someone who has placed an order. Not every User is a Customer.
_Avoid_: Buyer, client

### Buying

**Bag**:
The products a Guest or User has chosen to buy, before checkout. It holds no Stock and no price of its own: it always shows the current catalogue price.
_Avoid_: Cart, basket, shopping cart

**Bag item**:
One product in a Bag, with how many of it are wanted.
_Avoid_: Line, cart item, entry

**Stock**:
The number of units of a product that can be ordered online right now. Adding a product to a Bag does not take it out of Stock.
_Avoid_: Inventory, availability
