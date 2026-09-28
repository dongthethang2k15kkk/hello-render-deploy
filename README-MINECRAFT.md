# Minecraft Style Website

Website phong cách Minecraft với hiệu ứng glassmorphism hiện đại, lấy cảm hứng từ minecraft.net

## Tính năng

- ✅ Font chữ Minecraft chính thức (từ CDN)
- ✅ Hiệu ứng glassmorphism (kính lỏng) với backdrop blur
- ✅ Dark theme với surface levels bậc thang
- ✅ Button với shadow và hover effects giống Minecraft
- ✅ Grid layout responsive
- ✅ Animations (floating hero content)
- ✅ Custom scrollbar styling
- ✅ Fluid typography với clamp()
- ✅ CSS custom properties (design tokens)

## Cấu trúc file

```
hello/
├── index.html          # Trang HTML chính
├── style.css           # CSS với Minecraft styling
├── assets/             # Thư mục chứa ảnh
│   ├── minecraft-bg.jpg    # Ảnh background Minecraft
│   ├── horse1.jpg          # Ảnh ngựa trong sương mù
│   ├── horse2.jpg          # Ảnh ngựa trong bồn tắm
│   ├── horse3.jpg          # Ảnh ngựa sạc điện thoại
│   ├── horse4.jpg          # Ảnh ngựa ở ga tàu
│   └── horse5.jpg          # Ảnh ngựa trên phố
└── README-MINECRAFT.md # File hướng dẫn này
```

## Thêm ảnh

Để website hiển thị đầy đủ, hãy lưu các ảnh bạn đã gửi vào thư mục `assets/` với tên file như sau:

1. **minecraft-bg.jpg** - Ảnh Minecraft game (ảnh 2)
2. **horse1.jpg** - Ảnh ngựa trong sương mù (ảnh 3)  
3. **horse2.jpg** - Ảnh ngựa trong bồn tắm đeo kính (ảnh 4)
4. **horse3.jpg** - Ảnh ngựa ngồi sạc điện thoại (ảnh 5)
5. **horse4.jpg** - Ảnh ngựa nhỏ ở ga tàu (ảnh 6)
6. **horse5.jpg** - Ảnh ngựa nhỏ đứng trên phố (ảnh 7)

## Xem website

1. Mở trình duyệt
2. Kéo thả file `index.html` vào cửa sổ trình duyệt
3. Hoặc double-click file `index.html`

Website đã được mở tự động khi tạo xong.

## Thiết kế

### Color Palette
- **Dark surfaces**: 6 cấp độ từ #0a0e14 đến #2d3a4e
- **Accent colors**: Cyan (#38bdf8), Emerald (#6ee7b7), Gold (#fbbf24)
- **Minecraft colors**: Grass green, Diamond cyan, Gold, Redstone

### Typography
- **Font chính**: Minecraft (từ CDN fonts.cdnfonts.com)
- **Font phụ**: Noto Sans
- **Fluid sizing**: clamp() cho responsive tự động

### Effects
- **Glassmorphism**: backdrop-filter blur 20px
- **Shadows**: 4 cấp độ từ sm đến xl
- **Animations**: Float effect cho hero section
- **Hover states**: Scale, transform, glow effects

### Layout
- **CSS Grid**: Cho features section và gallery
- **Flexbox**: Cho nội dung trong các card
- **Responsive**: Breakpoint tại 768px

## Tùy chỉnh

Tất cả các giá trị thiết kế được lưu trong CSS custom properties (`:root`), bạn có thể dễ dàng thay đổi:

- Màu sắc: `--accent-primary`, `--surface-*`
- Khoảng cách: `--space-*`
- Bo góc: `--radius-*`
- Bóng đổ: `--shadow-*`
- Font: `--font-minecraft`, `--font-body`

## Browser support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support  
- Safari: ✅ Full support (với -webkit-backdrop-filter)

## Credits

Thiết kế lấy cảm hứng từ minecraft.net với phong cách glassmorphism hiện đại.
