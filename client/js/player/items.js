function Item(type) {
    this.type = type;
}

Item.prototype.stackable = function () {
    return Item.isStackable(this.type);
};

Item.prototype.name = function () {
    return Item.DATA[this.type].name;
};

Item.prototype.model = function () {
    return Item.DATA[this.type].model;
};

Item.prototype.action = function () {
    return Item.DATA[this.type].action;
};

Item.NIL    = 0x0;
Item.DIRT   = 0x1;
Item.STONE  = 0x2;
Item.SHOVEL = 0x3;
Item.GUN    = 0x4;

// Item properties
Item.STACKABLE = 0x1;

Item.PROPERTIES = [
    /** NIL    */ 0,
    /** DIRT   */ Item.STACKABLE,
    /** STONE  */ Item.STACKABLE,
    /** SHOVEL */ 0,
    /** GUN    */ 0,
];

Item.isStackable = function (item) {
    return Item.hasPropertie(item, Item.STACKABLE);
};

Item.hasPropertie = function (item, prop) {
    return (Item.PROPERTIES[block] & prop) > 0;
};


Item.init = function() {
    Item.DATA = [
        {
            name: '&#09;&#09;', // Tab characters
            model: null,
            action: null,
        },{
            name: 'dirt',
            model: Models.block(),
            action: Item.throttle(Item.blockAction, Block.DIRT),
        },{
            name: 'stone',
            model: Models.stone(),
            action: Item.throttle(Item.blockAction, Block.STONE),
        },{
            name: 'shovel',
            model: Models.shovel(),
            action: Item.throttle(Item.shovelAction),
        },{
            name: 'pistol',
            model: Models.pistol(),
            action: Item.pistolAction,
        }
    ];
};

Item.throttle = function (func, param) {
    var t = Date.now();
    return function (world, camera) {
        var t2 = Date.now();
        if (t2 - t > 200) {
            func(world, camera, param);
            t = t2;
        }
    };
};

Item.pistolAction = function (world, camera) {
    var intersect = world.findPlayerIntersection(camera);
    if (intersect) {
        console.log("Hit!!", intersect, intersect.item);
    } else {
        console.log("miss!!");
    }
};

Item.shovelAction = function (world, camera) {
    world.removeLookedAtBlock(camera);
};

Item.blockAction = function (world, camera, block) {
    world.addLookedAtBlock(camera, block);
};
