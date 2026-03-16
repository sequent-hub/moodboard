## 8) Отчет по сетке Miro (скриншоты 400% -> 92%)

Ниже отчет по предоставленным скриншотам. Цель: измерить шаг клеток, цвет линий сетки и зафиксировать поведение более темной сетки при уменьшении зума.

### 8.1. Что именно измерялось

- шаг основной видимой сетки в пикселях (горизонталь/вертикаль);
- цвет фона поля;
- цвет более светлой сетки;
- цвет более темной сетки;
- наличие визуально выраженных более темных линий на разных масштабах.

### 8.2. Итоговые значения цветов (по выборке кадров)

- фон: около `RGB(255, 255, 255)`;
- светлая сетка: около `RGB(254, 254, 254)`;
- более темная сетка/линии: около `RGB(243..246, 243..246, 243..246)`.

### 8.3. Измеренный шаг основной сетки по зуму

| Зум | Шаг клетки, px (прибл.) |
|---|---:|
| 400% | 43 |
| 357% | 38 |
| 319% | 34 |
| 285% | 30 |
| 254% | 27 |
| 227% | 24 |
| 203% | 22 |
| 181% | 19-20 |
| 162% | 17 |
| 144% | 15-16 |
| 129% | 14 |
| 115% | 12 |
| 103% | 11 |
| 92%  | 10 |

### 8.4. Наблюдение по "второй более темной сетке"

- Более темные линии в кадрах присутствуют и измеряются по уровню яркости (они темнее основной светлой сетки).
- По статическим PNG нельзя однозначно подтвердить момент "включения" отдельного второго слоя сетки.
- На части масштабов картина соответствует варианту наложения нескольких шагов/уровней сетки, но для точного вывода нужен покадровый захват при плавном изменении масштаба (например, по 1%).

### 8.5. Предоставленные скриншоты

#### 400%
![400%](C:\Users\popov\.cursor\projects\c-Users-popov-Herd-futurello-moodboard\assets\c__Users_popov_AppData_Roaming_Cursor_User_workspaceStorage_e451b74f8307132edff31575bf1df007_images_image-bb3c65fc-8fad-4e04-b83b-d4fb742afbca.png)

#### 357%
![357%](C:\Users\popov\.cursor\projects\c-Users-popov-Herd-futurello-moodboard\assets\c__Users_popov_AppData_Roaming_Cursor_User_workspaceStorage_e451b74f8307132edff31575bf1df007_images_image-ddfff519-ce81-4ad0-bfc2-95423191445d.png)

#### 319%
![319%](C:\Users\popov\.cursor\projects\c-Users-popov-Herd-futurello-moodboard\assets\c__Users_popov_AppData_Roaming_Cursor_User_workspaceStorage_e451b74f8307132edff31575bf1df007_images_image-acb540c4-2f0a-4bd4-99cc-1247ca9ffd05.png)

#### 285%
![285%](C:\Users\popov\.cursor\projects\c-Users-popov-Herd-futurello-moodboard\assets\c__Users_popov_AppData_Roaming_Cursor_User_workspaceStorage_e451b74f8307132edff31575bf1df007_images_image-3ab0b1c9-9b3d-42f7-ab64-aa1576592421.png)

#### 254%
![254%](C:\Users\popov\.cursor\projects\c-Users-popov-Herd-futurello-moodboard\assets\c__Users_popov_AppData_Roaming_Cursor_User_workspaceStorage_e451b74f8307132edff31575bf1df007_images_image-67d4a272-e9b9-4a96-8a4b-401b1e66482c.png)

#### 227%
![227%](C:\Users\popov\.cursor\projects\c-Users-popov-Herd-futurello-moodboard\assets\c__Users_popov_AppData_Roaming_Cursor_User_workspaceStorage_e451b74f8307132edff31575bf1df007_images_image-373ecca5-3c55-41e6-8c36-4d0587881f0e.png)

#### 203%
![203%](C:\Users\popov\.cursor\projects\c-Users-popov-Herd-futurello-moodboard\assets\c__Users_popov_AppData_Roaming_Cursor_User_workspaceStorage_e451b74f8307132edff31575bf1df007_images_image-fbe6c1b4-6d78-4ee6-9363-3b2eacaa6b3b.png)

#### 181%
![181%](C:\Users\popov\.cursor\projects\c-Users-popov-Herd-futurello-moodboard\assets\c__Users_popov_AppData_Roaming_Cursor_User_workspaceStorage_e451b74f8307132edff31575bf1df007_images_image-fb74cc01-b47f-4aec-95fb-e6d343f8a77d.png)

#### 162%
![162%](C:\Users\popov\.cursor\projects\c-Users-popov-Herd-futurello-moodboard\assets\c__Users_popov_AppData_Roaming_Cursor_User_workspaceStorage_e451b74f8307132edff31575bf1df007_images_image-0699f648-3a08-444e-9297-ea2ed25e60c6.png)

#### 144%
![144%](C:\Users\popov\.cursor\projects\c-Users-popov-Herd-futurello-moodboard\assets\c__Users_popov_AppData_Roaming_Cursor_User_workspaceStorage_e451b74f8307132edff31575bf1df007_images_image-f057f68d-24ac-436e-bc35-7df329126021.png)

#### 129%
![129%](C:\Users\popov\.cursor\projects\c-Users-popov-Herd-futurello-moodboard\assets\c__Users_popov_AppData_Roaming_Cursor_User_workspaceStorage_e451b74f8307132edff31575bf1df007_images_image-f52aa855-cbce-4174-a57e-675f9e0c7c6b.png)

#### 115%
![115%](C:\Users\popov\.cursor\projects\c-Users-popov-Herd-futurello-moodboard\assets\c__Users_popov_AppData_Roaming_Cursor_User_workspaceStorage_e451b74f8307132edff31575bf1df007_images_image-2bd13cf4-0aca-4111-a012-9f34c1336d3b.png)

#### 103%
![103%](C:\Users\popov\.cursor\projects\c-Users-popov-Herd-futurello-moodboard\assets\c__Users_popov_AppData_Roaming_Cursor_User_workspaceStorage_e451b74f8307132edff31575bf1df007_images_image-856eb4a9-7274-4366-89cd-4b6bd3828cba.png)

#### 92%
![92%](C:\Users\popov\.cursor\projects\c-Users-popov-Herd-futurello-moodboard\assets\c__Users_popov_AppData_Roaming_Cursor_User_workspaceStorage_e451b74f8307132edff31575bf1df007_images_image-24e0e534-9463-482c-8051-416e61b0543e.png)
