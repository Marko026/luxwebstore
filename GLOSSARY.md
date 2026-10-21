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

**Subtotal**:
What a Bag costs together at current catalogue prices, VAT included. A sold-out Bag item is left out; a Bag item with more units than are left in Stock still counts at its full quantity, so lowering it is the Guest's or User's own choice.
_Avoid_: Order total, grand total
