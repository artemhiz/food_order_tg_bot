require('dotenv').config();
const express = require('express');
const app = express();
const TelegramAPI = require('node-telegram-bot-api');
const products = require('./catalog/catalog');
const bot = new TelegramAPI(process.env.TOKEN, { polling: true });
const adminID = process.env.ADMIN_ID_ORDERS;

app.get('/', (req, res) => {
    res.send('Hello world!');
})
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Server listens at port ${port}`));

let selectedItem = {};
let shoppingCart = {};
let orderCache = {};

const pieces = ['1 шт.', '2 шт.', '3 шт.', '4 шт.', '5 шт.', '6 шт.', '7 шт.', '8 шт.', '9 шт.', '10 шт.'];
const kilos = ['200гр', '500гр', '800гр', '1кг', '1.2кг', '1.2кг'];

bot.setMyCommands([
    {
        command: '/start',
        description: 'Перезапустить бота',
    },
    {
        command: '/order',
        description: 'Сделать заказ',
    },
    {
        command: '/cart',
        description: 'Корзина',
    },
])

async function start(chatID) {
    selectedItem[chatID] = undefined;
    shoppingCart[chatID] = [];
    orderCache[chatID] = undefined;
    return bot.sendMessage(
        chatID,
        'Добро пожаловать в тестовый бот. Выберите действие',
        {
            reply_markup: {
                keyboard: [['Сделать заказ']],
                resize_keyboard: true,
            }
        }
    )
}

bot.on('callback_query', async message => {
    const chatID = message.message.chat.id;

    switch (message.data) {
        case '/cancel':
            orderCache[chatID] = undefined;
            return bot.sendMessage(chatID, 'Заказ отменён. Хотите очистить корзину или добавить еще что-то?', {
                reply_markup: {
                    keyboard: [
                        ['Продолжить покупки'],
                        ['Очистить корзину'],
                    ],
                    resize_keyboard: true,
                }
            })
    }
})

bot.on('message', async message => {
    const chatID = message.chat.id;
    try {
        const itemsList = await products.getProductsList();
        switch (message.text) {
            case '/start':
            case 'Перезапустить бота':
            case 'Очистить корзину':
                return start(chatID);
            case '/cart':
            case 'Перейти в корзину':
                if (!shoppingCart[chatID] || shoppingCart[chatID].length === 0) {
                    await bot.sendMessage(chatID, 'У вас пока ничего нет в корзине. Вы можете выбрать что-нибудь из нашего каталога')
                } else {
                    const cartItems = shoppingCart[chatID].map(item => {
                        return `${item.title} (${item.quantity} ${item.countable ? 'шт.' : 'гр'}) – ${item.countable ? (item.price * item.quantity) : (item.price / 1000 * item.quantity)}₽`;
                    })
                    let totalPrice = 0;
                    shoppingCart[chatID].map(item => {
                        totalPrice += item.countable ? (item.price * item.quantity) : (item.price / 1000 * item.quantity)
                    })
                    const replyMessage = `${cartItems.join('\n')}
                    \nИтого: ${totalPrice}₽`
                    return bot.sendMessage(
                        chatID,
                        replyMessage,
                        {
                            reply_markup: {
                                keyboard: [
                                    ['< Назад', 'Очистить корзину'],
                                    ['Оформить заказ'],
                                ],
                                resize_keyboard: true,
                                one_time_keyboard: true,
                            }
                        }
                    )
                }
            case '/order':
            case 'Сделать заказ':
            case 'Продолжить покупки':
            case '< Назад':
                selectedItem[chatID] = undefined;
                if (itemsList.length > 0) {
                    return bot.sendMessage(
                        chatID,
                        'Вот, что у нас есть сегодня:',
                        {
                            reply_markup: {
                                keyboard: itemsList.map(item => [item]),
                                resize_keyboard: true,
                            }
                        }
                    )
                } else {
                    return bot.sendMessage(chatID, 'Кажется, в данный момент товары только готовятся к продаже. Зайдите позже');
                }
            case 'Оформить заказ':
                orderCache[chatID] = { name: undefined, cart: shoppingCart[chatID], telephone: undefined, pickup: undefined };
                return bot.sendMessage(chatID, 'Переходим к формированию. заказа.\nСначала сообщите, как вас зовут.', {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Отменить оформление заказа', callback_data: '/cancel' },
                            ]
                        ]
                    }
                })
        }

        if (itemsList.includes(message.text)) {
            const foundItem = await products.findProduct(message.text);

            const { title, description, countable, price, quantity_in_stock } = foundItem;
            selectedItem[chatID] = title;
            const keyboardToReply = countable ? [
                [
                    '< Назад',
                ],
                [
                    '1 шт.',
                    quantity_in_stock >= 2 && '2 шт.',
                    quantity_in_stock >= 3 && '3 шт.',
                ].filter(Boolean),
                [
                    quantity_in_stock >= 4 && '4 шт.',
                    quantity_in_stock >= 5 && '5 шт.',
                    quantity_in_stock >= 6 && '6 шт.',
                ].filter(Boolean),
                [
                    quantity_in_stock >= 7 && '7 шт.',
                    quantity_in_stock >= 8 && '8 шт.',
                    quantity_in_stock >= 9 && '9 шт.',
                ].filter(Boolean),
                [
                    quantity_in_stock >= 10 && '10 шт.',
                ].filter(Boolean)
            ] : [
                [
                    '< Назад',
                ],
                [
                    '200гр',
                    quantity_in_stock >= 500 && '500гр',
                    quantity_in_stock >= 800 && '800гр',
                ].filter(Boolean),
                [
                    quantity_in_stock >= 1000 && '1кг',
                    quantity_in_stock >= 1200 && '1.2кг',
                    quantity_in_stock >= 1500 && '1.5кг',
                ].filter(Boolean),
            ]
            if (quantity_in_stock > 0) {
                return bot.sendMessage(
                    chatID,
                    `${title}\n${description}\n${price}₽/${countable ? 'шт.' : 'кг'}\n\nСколько нужно?`,
                    {
                        reply_markup: {
                            keyboard: keyboardToReply,
                            resize_keyboard: true,
                        }
                    }
                )
            } else {
                return bot.sendMessage(
                    chatID,
                    `${title} уже раскупили. Очень жаль...`,
                    {
                        reply_markup: {
                            keyboard: [['< Назад']],
                            resize_keyboard: true,
                            one_time_keyboard: true,
                        }
                    }
                )
            }
        }

        if ((pieces.includes(message.text) || kilos.includes(message.text)) && selectedItem[chatID] !== undefined) {
            const foundItem = await products.findProduct(selectedItem[chatID]);

            let reservedQuantity;
            if (foundItem.countable) {
                reservedQuantity = pieces.indexOf(message.text) + 1;
            } else {
                switch (message.text) {
                    case kilos[0]:
                        reservedQuantity = 200;
                        break;
                    case kilos[1]:
                        reservedQuantity = 500;
                        break;
                    case kilos[2]:
                        reservedQuantity = 800;
                        break;
                    case kilos[3]:
                        reservedQuantity = 1000;
                        break;
                    case kilos[4]:
                        reservedQuantity = 1200;
                        break;
                    case kilos[5]:
                        reservedQuantity = 1500;
                        break;
                }
            }
            shoppingCart[chatID].push({ title: foundItem.title, countable: foundItem.countable, quantity: reservedQuantity, price: foundItem.price });
            return bot.sendMessage(
                chatID,
                `Добавили ${foundItem.title} (${reservedQuantity} ${foundItem.countable ? 'шт.' : 'гр'}) в корзину!\nХотите выбрать ещё что-нибудь?`,
                {
                    reply_markup: {
                        keyboard: [
                            ['Продолжить покупки'],
                            ['Перейти в корзину'],
                        ],
                        resize_keyboard: true,
                    },
                },
            )
        } else if ((pieces.includes(message.text) || kilos.includes(message.text)) && selectedItem[chatID] === undefined) {
            return bot.sendMessage(
                chatID,
                'Сначала выберите продукт',
                {
                    reply_markup: {
                        keyboard: [['Продолжить покупки']],
                        resize_keyboard: true,
                    },
                },
            )
        }

        if (orderCache[chatID] !== undefined) {
            function replyReceipt() {
                let totalPrice = 0;
                const cartList = orderCache[chatID].cart.map(item => {
                    totalPrice += item.countable ? (item.price * item.quantity) : (item.price / 1000 * item.quantity);
                    return `${item.title} (${item.quantity} ${item.countable ? 'шт.' : 'гр'}) – ${item.countable ? (item.price * item.quantity) : (item.price / 1000 * item.quantity)}₽`;
                })
                return bot.sendMessage(
                    chatID,
                    `Отлично! Значит, ваш заказ будет с ${orderCache[chatID].pickup ? 'самовывозом' : 'доставкой на дом'}. Проверьте ваш заказ. Если всё хорошо, я отправлю его на выполнение:
-----------
${cartList.join('\n')}

Итого: ${totalPrice}₽
------------
Имя: ${orderCache[chatID].name}
Телефон: ${orderCache[chatID].telephone}
${orderCache[chatID].pickup ? 'Самовывоз' : 'С доставкой на дом'}
Всё правильно?`,
                    {
                        reply_markup: {
                            keyboard: [
                                ['Да, всё правильно'],
                                ['Изменить информацию'],
                            ],
                            resize_keyboard: true,
                            one_time_keyboard: true,
                        }
                    }
                )
            }

            switch (message.text) {
                case 'Доставка':
                    orderCache[chatID].pickup = false;
                    return replyReceipt();
                case 'Самовывоз':
                    orderCache[chatID].pickup = true;
                    return replyReceipt();
                case 'Изменить информацию':
                    orderCache[chatID] = { name: undefined, cart: orderCache[chatID].cart, telephone: undefined, pickup: undefined };
                    await bot.sendMessage(chatID, 'Ой. Тогда повторим оформление заказа');
                    return bot.sendMessage(chatID, 'Сначала сообщите, как вас зовут.', {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Отменить оформление заказа', callback_data: '/cancel' },
                                ]
                            ]
                        }
                    })
                case 'Да, всё правильно':
                    let totalPrice = 0;
                    orderCache[chatID].cart.map(item => {
                        totalPrice += item.countable ? item.price * item.quantity : item.price / 1000 * item.quantity;
                    })
                    await bot.sendMessage(adminID, `❕ Новый заказ\nЗаказчик(-ца): ${orderCache[chatID].name}\nНомер телефона: ${orderCache[chatID].telephone}\n${orderCache[chatID].pickup ? 'Самовывоз' : 'Доставка'}\nЗаказ: ${orderCache[chatID].cart.map(item => {
                        return `${item.title} – ${item.quantity} ${item.countable ? 'шт.' : 'гр'}`
                    }).join('\n')}\n\nОбщая сумма: ${totalPrice}`);
                    orderCache[chatID].cart.forEach(async item => {
                        await products.reserveProduct(item.title, item.quantity);
                    })
                    orderCache[chatID] = undefined;
                    await bot.sendMessage(chatID, 'Поздравляем!\nВаш заказ оформлен. Сохраните чек выше, чтобы не потерять заказ. Возвращаю вас в главное меню.\nУдачного дня!');
                    return start(chatID);
            }
            if (orderCache[chatID].name === undefined) {
                orderCache[chatID].name = message.text;
                return bot.sendMessage(chatID, `Хорошо, ${orderCache[chatID].name}. Теперь укажите свой номер телефона, по которому мы сможем с вами связаться`)
            } else if (orderCache[chatID].telephone === undefined) {
                orderCache[chatID].telephone = message.text;
                return bot.sendMessage(chatID, `Значит, с вами свяжутся по этому номеру телефона. Вы бы хотели оформить доставку, или вы сможете забрать заказ самостоятельно?`, {
                    reply_markup: {
                        keyboard: [
                            ['Доставка'],
                            ['Самовывоз'],
                        ],
                        resize_keyboard: true,
                    }
                })
            }
        }
    } catch (error) {
        console.error('Error fetching products:', error.message);
        return bot.sendMessage(
            chatID,
            'Произошла ошибка при загрузке данных. Пропробуйте позже',
            {
                reply_markup: {
                    keyboard: [['Перезапустить бота']],
                    resize_keyboard: true,
                    one_time_keyboard: true,
                }
            }
        );
    }
})

const adminBot = new TelegramAPI(process.env.ADMIN_TOKEN, { polling: true });

let adming = {};
let editor = {};
let creationCache = {};

adminBot.setMyCommands([
    {
        command: '/start',
        description: 'Перезапустить бота',
    },
    {
        command: '/catalog',
        description: 'Управление каталогом',
    },
    {
        command: '/stock',
        description: 'Изменить наличие на складе',
    },
])

async function catalog(chatID) {
    const menuItems = await products.getProductsListForAdmin();
    const replyButtons = {
        reply_markup: {
            inline_keyboard: menuItems.map(itemTitle => {
                return [{
                    text: itemTitle,
                    callback_data: `/edit ${itemTitle}`,
                }]
            }),
        }
    }
    await adminBot.sendMessage(chatID, 'Выберите, что редактировать', replyButtons);
    return adminBot.sendMessage(chatID, 'Или создайте новый элемент по кнопке ниже', {
        reply_markup: {
            keyboard: [['< Назад'], ['Создать новый элемент']],
            resize_keyboard: true,
            one_time_keyboard: true,
        }
    })
}

async function stock(chatID) {
    adming[chatID] = { mode: 'stock', object: undefined };
    editor[chatID] = undefined;
    const stock = await products.getStockForAdmin();
    const replyButtons = {
        reply_markup: {
            inline_keyboard: stock.map(item => {
                return [{ text: `${item.title} – ${!item.countable && item.quantity_in_stock >= 1000 ? item.quantity_in_stock / 1000 : item.quantity_in_stock} ${item.countable ? 'шт.' : item.quantity_in_stock >= 1000 ? 'кг' : 'г'}${item.quantity_in_stock === 0 ? ' (❗️ не осталось)' : !item.countable && item.quantity_in_stock <= 100 ? ' (❕ недостаточно)' : '' }`, callback_data: `/change-quantity ${item.title}` }]
            })
        }
    }
    await adminBot.sendMessage(chatID, 'Выберите товар, количество которого хотите изменить', replyButtons);
    return adminBot.sendMessage(chatID, 'Если всё в порядке, можете вернуться по кнопке ниже', { reply_markup: { keyboard: [['< Назад']], resize_keyboard: true, one_time_keyboard: true } });
}

async function editorPage(chatID, message) {
    adming[chatID] = { mode: 'edit', object: message.data.split(' ')[1] };
    editor[chatID] = undefined;
    const foundItem = await products.findProduct(adming[chatID].object);
    return adminBot.sendMessage(
        chatID,
        `Название: ${foundItem.title}\n\nОписание: ${foundItem.description}\n\n${foundItem.countable ? 'Поштучно' : 'На развес'}\n\n${foundItem.price}₽/${foundItem.countable ? 'шт.' : 'кг'}`,
        {
            reply_markup: {
                keyboard: [
                    ['<< Назад'],
                    ['Изменить название'],
                    ['Изменить описание'],
                    ['Изменить цену'],
                    ['Удалить товар'],
                ],
                resize_keyboard: true,
                one_time_keyboard: true,
            }
        }
    )
}

adminBot.on('callback_query', async message => {
    const chatID = message.message.chat.id;
    try {
        if (chatID === Number(adminID)) {
            if (message.data.includes('/edit')) {
                return editorPage(chatID, message);
            } else if (message.data.includes('/cancel')) {
                switch (message.data.split(' ')[1]) {
                    case 'deletion':
                        await adminBot.sendMessage(chatID, 'Хорошо. Удаление отменено. Возвращаю вас к товару');
                        return editorPage(chatID, message);
                    case 'creation':
                        await adminBot.sendMessage(chatID, 'Создание отменено. Возвращаю вас в каталог');
                        return catalog(chatID);
                }
            } else if (message.data.includes('/change-quantity')) {
                adming[chatID].object = message.data.split(' ')[1];
                const foundItem = await products.findProduct(adming[chatID].object);
                return adminBot.sendMessage(chatID, `Укажите новое количество товара ${foundItem.title} в ${foundItem.countable ? 'штуках' : 'граммах'}. Напишите только число.\nПример: ${foundItem.countable ? '8' : '1200'}`);
            } else if (message.data === 'no-description') {
                creationCache[chatID] = { ...creationCache[chatID], description: '' };
                editor[chatID].type = 'countability';
                await adminBot.sendMessage(chatID, `Хорошо, ${creationCache[chatID].title ? creationCache[chatID].title : 'товар'} будет без описания`);
                return adminBot.sendMessage(chatID, `Будет ли ${creationCache[chatID].title ? creationCache[chatID].title : 'товар'} продаваться поштучно или наразвес?`, {
                    reply_markup: {
                        keyboard: [
                            ['Поштучно'],
                            ['На развес'],
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: true,
                    }
                })
            }
        } else {
            return adminBot.sendMessage(chatID, 'У вас нет доступа к администрированию в этом боте. Для заказа еды воспользуйтесь другим ботом')
        }
    } catch (error) {
        console.error(`Error in Admin Bot: ${error.message}`);
        adminBot.sendMessage(chatID, 'Произошла ошибка. Повторите попытку', {
            reply_markup: {
                keyboard: [['Перезапустить бота']],
                one_time_keyboard: true,
                resize_keyboard: true,
            }
        });
    }
})

adminBot.on('message', async message => {
    const chatID = message.chat.id;
    try {
        if (`${chatID}` === adminID) {
            let foundItem;
            switch (message.text) {
                case '/start':
                case '/back':
                case '< Назад':
                case 'Перезапустить бота':
                    adming[chatID] = { mode: undefined, object: undefined };
                    creationCache[chatID] = undefined;
                    return adminBot.sendMessage(chatID, 'Добро пожаловать!\n\n/catalog - Редактировать каталог товаров\n\n/stock – Управление наличием на складе');
                case '/catalog':
                case '<< Назад':
                    return catalog(chatID);
                case 'Изменить название':
                    editor[chatID] = { type: 'title', original: adming[chatID].object, edited: '' };
                    return adminBot.sendMessage(chatID, `Введите новое название, вместо "${adming[chatID].object}"`);
                case 'Изменить описание':
                    foundItem = await products.findProduct(adming[chatID].object);
                    editor[chatID] = { type: 'description', original: foundItem.description, edited: '' };
                    return adminBot.sendMessage(chatID, `Введите новое описание для продукта "${foundItem.title}"`);
                case 'Изменить цену':
                    foundItem = await products.findProduct(adming[chatID].object);
                    editor[chatID] = { type: 'price', original: foundItem.price, edited: '' };
                    return adminBot.sendMessage(chatID, `Введите новую цену для продукта "${foundItem.title}". Веедите только число!\nПример: 2000`);
                case 'Удалить товар':
                    editor[chatID] = { type: 'deletion', original: adming[chatID].object, edited: '' };
                    return adminBot.sendMessage(chatID, `Если вы действительно хотите удалить товар "${adming[chatID].object}", то напишите его название в ответ на это сообщение, чтобы подтвердить действие`, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Отменить удаление', callback_data: '/cancel deletion' }],
                            ]
                        }
                    })
                case 'Создать новый элемент':
                    adming[chatID].mode = 'creation';
                    editor[chatID] = { type: 'title' };
                    return adminBot.sendMessage(chatID, 'Переходим к созданию нового продукта. Укажите название', {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Отменить создание товара', callback_data: '/cancel creation' }],
                            ],
                        }
                    })
                case '/stock':
                    return stock(chatID)
            }
            if (editor[chatID] !== undefined) {
                if (adming[chatID].mode === 'edit') {
                    editor[chatID].edited = message.text;
                    const editing = editor[chatID];
                    switch (editing.type) {
                        case 'title':
                            await products.changeTitle(adming[chatID].object, editing.edited);
                            await adminBot.sendMessage(chatID, `Название продукта "${adming[chatID].object}" изменено на "${editing.edited}". Возвращаю вас в главное меню`);
                            return catalog(chatID);
                        case 'description':
                            products.changeDescription(adming[chatID].object, editing.edited);
                            await adminBot.sendMessage(chatID, `Изменили описание продукта ${adming[chatID].object}. Возвращаю вас в главное меню`);
                            return catalog(chatID);
                        case 'price':
                            products.changePrice(adming[chatID].object, editing.edited);
                            await adminBot.sendMessage(chatID, `Изменили цену продукта ${adming[chatID].object}. Возвращаю вас в главное меню`);
                            return catalog(chatID);
                        case 'deletion':
                            if (message.text === adming[chatID].object) {
                                products.deleteItem(adming[chatID].object);
                                await adminBot.sendMessage(chatID, 'Товар успешно удалён. Возвращаю вас в каталог');
                                return catalog(chatID);
                            } else {
                                return adminBot.sendMessage(chatID, `Ваше сообщение не соответстует названию товара "${adming[chatID].object}. Проробуйте ещё раз"`);
                            }
                    }
                } else if (adming[chatID].mode === 'creation') {
                    switch (editor[chatID].type) {
                        case 'title':
                            if (!(await products.getProductsListForAdmin()).includes(message.text)) {
                                creationCache[chatID] = { ...creationCache[chatID], title: message.text };
                                editor[chatID] = { type: 'description' };
                                return adminBot.sendMessage(chatID, 'Отлично! Переходим к описанию товара. Напишите его в следующем сообщении', {
                                    reply_markup: {
                                        inline_keyboard: [
                                            [
                                                { text: 'Оставить без описания', callback_data: 'no-description' },
                                            ],
                                        ],
                                    }
                                })
                            } else {
                                return adminBot.sendMessage(chatID, 'Продукт с таким названием уже существует, пожалуйста, назвите продукт по-другому или укажите больше деталей в названии.')
                            }
                        case 'description':
                            creationCache[chatID] = { ...creationCache[chatID], description: message.text };
                            editor[chatID].type = 'countability';
                            return adminBot.sendMessage(chatID, `Будет ли ${creationCache[chatID].title ? creationCache[chatID].title : 'товар'} продаваться поштучно или наразвес?`, {
                                reply_markup: {
                                    keyboard: [
                                        ['Поштучно'],
                                        ['На развес'],
                                    ],
                                    resize_keyboard: true,
                                    one_time_keyboard: true,
                                }
                            })
                        case 'countability':
                            const countable = message.text === 'Поштучно' ? 1 : 0;
                            creationCache[chatID] = { ...creationCache[chatID], countable };
                            editor[chatID].type = 'price';
                            return adminBot.sendMessage(chatID, `Хорошо, ${creationCache[chatID].title ? creationCache[chatID].title : 'товар'} будет продаваться ${creationCache[chatID].countable ? 'поштучно' : 'на развес'}. Теперь укажите цену за ${creationCache[chatID].countable ? 'штуку' : 'килограмм'}. Напишите только число.\nПример: 800`);
                        case 'price':
                            creationCache[chatID] = { ... creationCache[chatID], price: message.text };
                            editor[chatID].type = 'availability';
                            return adminBot.sendMessage(chatID, `Теперь укажите, сколько ${creationCache[chatID].countable ? 'штук' : 'граммов'} товара у вас есть в наличии. Напишите только число.\nПример: ${creationCache[chatID].countable ? '5' : '2500'}\n(вы сможете изменить это позже)`);
                        case 'availability':
                            creationCache[chatID] = { ...creationCache[chatID], quantity_in_stock: message.text };
                            const { title, description, price } = creationCache[chatID];
                            products.createItem(creationCache[chatID]);
                            await adminBot.sendMessage(chatID, `Отлично! Вот новая карточка товара:\n------------\n${title}\n\n${description}\n\n${price}₽/${creationCache[chatID].countable ? 'шт.' : 'кг'}\n-----------\nВозвращаю вас в каталог`);
                            return catalog(chatID);
                    }
                }
            } else if (adming[chatID].mode === 'stock') {
                products.changeQuantity(adming[chatID].object, message.text);
                await adminBot.sendMessage(chatID, `Количество товара ${adming[chatID].object} изменено! Возвращаю вас в главное меню`);
                return stock(chatID);
            }
        } else {
            return adminBot.sendMessage(chatID, 'У вас нет доступа к администрированию в этом боте. Для заказа еды воспользуйтесь другим ботом')
        }
    } catch (error) {
        console.error(`Error in Admin Bot: ${error.message}`);
        adminBot.sendMessage(chatID, 'Произошла ошибка. Повторите попытку', {
            reply_markup: {
                keyboard: [['Перезапустить бота']],
                one_time_keyboard: true,
                resize_keyboard: true,
            }
        });
    }
})