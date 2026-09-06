import secrets

BASE62_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"


def encode_base62(number: int) -> str:
    if number == 0:
        return BASE62_ALPHABET[0]

    result = []
    while number > 0:
        number, remainder = divmod(number, 62)
        result.append(BASE62_ALPHABET[remainder])

    return "".join(reversed(result))


def generate_random_code(length: int = 7) -> str:
    return "".join(secrets.choice(BASE62_ALPHABET) for _ in range(length))

