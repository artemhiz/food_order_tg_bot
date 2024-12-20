const sqlite3 = require('sqlite3');
const db = new sqlite3.Database("catalog.db", error => {
    if (error) throw new Error('Could not find Catalog database');
    console.log('Connected to Catalog Database');
})

db.serialize(() => {
    const request = `CREATE TABLE IF NOT EXISTS Products
    (title TEXT PRIMARY KEY, description TEXT, countable INTEGER NOT NULL DEFAULT 1, price REAL, quantity_in_stock INTEGER NOT NULL DEFAULT 1)`;

    db.run(request);
})

const getAllNames = async () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT title FROM Products WHERE (quantity_in_stock > 0 AND countable = 1) OR (quantity_in_stock >= 200 AND countable = 0)", (error, rows) => {
            if (error) {
                reject(error);
            } else {
                resolve(rows.map(({ title }) => title));
            }
        })
    })
}

const getProductsList = async () => {
    const productsList = await getAllNames();
    return productsList;
}

const getProductsListForAdmin = async () => {
    return new Promise(async (resolve, reject) => {
        db.all("SELECT title FROM Products", (error, products) => {
            if (error) {
                reject(error);
            } else {
                resolve(products.map(({ title }) => title));
            }
        })
    })
}

const getStockForAdmin = async () => {
    return new Promise(async (resolve, reject) => {
        db.all("SELECT title, countable, quantity_in_stock FROM Products", (error, products) => {
            if (error) {
                reject(error);
            } else {
                resolve(products);
            }
        })
    })
}

const findProduct = async itemName => {
    return new Promise ((resolve, reject) => {
        db.get("SELECT * FROM Products WHERE title = ?", [itemName], (error, product) => {
            if (error) {
                reject(error);
            } else {
                resolve(product);
            }
        })
    })
}

const reserveProduct = async (itemName, reservedQuantity) => {
    return new Promise(async (resolve, reject) => {
        const foundItem = await findProduct(itemName);
        if (foundItem.quantity_in_stock >= reservedQuantity) {
            db.get("UPDATE Products SET quantity_in_stock = ? WHERE title = ?", [foundItem.quantity_in_stock - reservedQuantity, itemName]);
            resolve('Successfully reserved an item');
        } else {
            reject('Not enough items in stock');
        }
    })
}

const changeCountable = async itemName => {
    return new Promise(async (resolve, reject) => {
        const foundItem = await findProduct(itemName);
        if (!foundItem) {
            reject('No item found with this name');
        } else {
            const changedValue = foundItem.countable === 1 ? 0 : 1;
            db.run("UPDATE Products SET countable = ? WHERE title = ?", [changedValue, itemName], error => {
                if (error) {
                    reject(error);
                } else {
                    resolve('Changed countability successfully');
                }
            });
        }
    })
}

const changeTitle = async (itemOriginalName, itemChangedName) => {
    return new Promise(async (resolve, reject) => {
        const foundItem = await findProduct(itemOriginalName);
        if (!foundItem) {
            reject('No item found with this name')
        } else {
            db.run("UPDATE Products SET title = ? WHERE title = ?", [itemChangedName, itemOriginalName], error => {
                if (error) {
                    reject(error);
                } else {
                    resolve(`Changed item title from ${itemOriginalName} to ${itemChangedName}`);
                }
            })
        }
    })
}

const changeDescription = (itemName, changedDescription) => {
    db.run("UPDATE Products SET description = ? WHERE title = ?", [changedDescription, itemName], error => {
        if (error) throw new Error(error);
    })
}

const changePrice = (itemName, changedPrice) => {
    db.run("UPDATE Products SET price = ? WHERE title = ?", [changedPrice, itemName], error => {
        if (error) throw new Error(error);
    })
}

const changeQuantity = (itemName, newQuantity) => {
    db.run("UPDATE Products SET quantity_in_stock = ? WHERE title = ?", [newQuantity, itemName], error => {
        if (error) throw new Error(error);
    })
}

const deleteItem = itemName => {
    db.run("DELETE FROM Products WHERE title = ?", [itemName], error => {
        if (error) throw new Error(error);
    })
}

const createItem = newItem => {
    const { title, description, countable, price, quantity_in_stock } = newItem;
    db.run("INSERT INTO Products(title, description, countable, price, quantity_in_stock) VALUES(?, ?, ?, ?, ?)", [title, description, countable, price, quantity_in_stock], error => {
        if (error) throw new Error(error);
    })
}

module.exports = { getProductsList, getProductsListForAdmin, getStockForAdmin, findProduct, reserveProduct, changeTitle, changeDescription, changePrice, changeQuantity, deleteItem, createItem };