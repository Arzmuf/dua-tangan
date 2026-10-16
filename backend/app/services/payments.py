"""Payments. For now every charge is pretend and succeeds; swap `charge` for a real provider
(Midtrans, Xendit, Stripe...) when payments go live."""

import secrets


class PaymentDeclined(Exception):
    pass


def charge(amount: int, method: str, description: str) -> str:
    """Takes `amount` rupiah via `method` and returns the provider's reference. Raises PaymentDeclined."""
    return f"MOCK-{secrets.token_hex(6).upper()}"
