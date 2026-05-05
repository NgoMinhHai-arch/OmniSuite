# Setup tren may moi (2 phut)

Khong can biet code, chi lam dung 3 buoc:

1. Tao file `.env` tu `.env.example`
- Neu dung Windows: copy file `.env.example` va doi ten thanh `.env`.

2. Mo file `.env`, them dong nay (hoac sua neu da co):
`INTERNAL_TOKEN=abc123_xyz_2026_private`

3. Chay du an nhu binh thuong.

## Luu y quan trong
- `INTERNAL_TOKEN` la chuoi ban tu dat, khong ton tien.
- Khong chia se token nay cong khai.
- Khong day file `.env` len Git.

## Neu bi loi
- Loi "Missing INTERNAL_TOKEN environment variable":
  kiem tra lai file `.env` da co dong `INTERNAL_TOKEN=...` chua.
