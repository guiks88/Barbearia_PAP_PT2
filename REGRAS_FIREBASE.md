# Regras do Firebase (Realtime Database)

Estas regras estao em database.rules.json e controlam leitura/escrita no Realtime Database.

## Regras atuais

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "admins": {
      "$uid": {
        ".read": "auth != null && (auth.uid === $uid || root.child('admins').child(auth.uid).exists())",
        ".write": "auth != null && auth.uid === $uid && (!root.child('admins').exists() || root.child('admins').child(auth.uid).exists())"
      }
    },
    "barbers": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && root.child('admins').child(auth.uid).exists()"
      }
    },
    "clients": {
      ".read": "auth != null && root.child('admins').child(auth.uid).exists()",
      "$uid": {
        ".read": "auth != null && (auth.uid === $uid || root.child('admins').child(auth.uid).exists())",
        ".write": "auth != null && (auth.uid === $uid || root.child('admins').child(auth.uid).exists())"
      }
    },
    "bookings": {
      ".read": "auth != null",
      "$bookingId": {
        ".write": "auth != null && (root.child('admins').child(auth.uid).exists() || (!data.exists() && newData.child('clientUid').val() === auth.uid) || (data.exists() && data.child('clientUid').val() === auth.uid && newData.child('clientUid').val() === auth.uid) || (data.exists() && data.child('barberId').val() === auth.uid && newData.child('barberId').val() === auth.uid))"
      }
    },
    "promotions": {
      ".read": true,
      ".write": "auth != null && root.child('admins').child(auth.uid).exists()"
    },
    "storeSettings": {
      ".read": true,
      ".write": "auth != null && root.child('admins').child(auth.uid).exists()"
    }
  }
}
```

## Observacoes

- Promocoes: leitura publica e escrita apenas para administradores.
- Bookings: clientes podem criar/editar apenas as suas, barbeiros apenas as deles, admins tudo.
- StoreSettings: leitura publica para mostrar horario da loja.
