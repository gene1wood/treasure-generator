/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */ /*global define */

"use strict";

var settings;

if (!Array.prototype.findIndex) {
    Array.prototype.findIndex = function(predicate) {
        if (this === null) {
            throw new TypeError("Array.prototype.findIndex called on null or undefined");
        }
        if (typeof predicate !== "function") {
            throw new TypeError("predicate must be a function");
        }
        var list = Object(this);
        var length = list.length >>> 0;
        var thisArg = arguments[1];
        var value;

        for (var i = 0; i < length; i++) {
            value = list[i];
            if (predicate.call(thisArg, value, i, list)) {
                return i;
            }
        }
        return -1;
    };
}

if (!String.prototype.format) {
    String.prototype.format = function(dict) {
        return this.replace(/{(\w+)}/g, function(match, key) {
            return typeof dict[key] !== 'undefined'
                ? dict[key]
                : match
                ;
        });
    };
}

var inRange = function (value, range) {
    // console.log("value is " + value + " range is " + range);
    return value >= (typeof range === "number" ? range : range[0]) &&
        value <= (typeof range === "number" ? range : range[1]);
};

var rollDie = function (die) {
    return Math.floor(Math.random() * die) + 1;
};

var getTableItem = function(obj) {
    if (Object.prototype.toString.call(obj) === "[object Array]") {
        // ["foo, "bar"]
        return obj[obj.length * Math.random() | 0];
    } else if (Object.prototype.toString.call(obj) === "[object Object]") {
        if (obj.hasOwnProperty("die") && obj.hasOwnProperty("options")) {
            // {"die": 20, "options": [{"range": [1,2], "type": "foo"}]
            var roll = rollDie(obj.die);
            return obj.options.find(function(element, index, array) {
                return inRange(roll, element.range);
            });
        } else {
            var result = {};
            var randomKey = Object.keys(obj)[Object.keys(obj).length * Math.random() | 0];
            for (var key of Object.keys(obj)) {
                if (key === "syntax") {
                    // {"foo": "bar", "syntax": "{foo} baz"}
                    result[key] = obj[key];
                } else if (Object.prototype.toString.call(obj[key]) === "[object Array]")  {
                    // {"foo": ["bar", "baz"], "boo": ["bur", "buz"]}
                    result[key] = obj[key][obj[key].length * Math.random() | 0];
                } else if (Object.prototype.toString.call(obj[key]) === "[object Object]")  {
                    // {"foo": {"bar": "baz"}, "far": {"bur": "buz"}}
                    if (key === randomKey) {
                        return key;
                    }
                }
            }
            return result;
        }
    }
};

var getTableItemWithReroll = function (obj, reRollOn) {
    var result;
    reRollOn = typeof reRollOn !== "undefined" ?  reRollOn : "DM's Choice";
    while ((result = getTableItem(obj))) {
        if (!("item" in result) || result.item != reRollOn) {
            break;
        }
    }
    return result;
};

var rollDice = function (range) {
    if (typeof range == "number") {
        return range;
    }
    return Math.floor(Math.random() * (1 + range[1] - range[0])) + range[0];
};

var getGroups = function (total) {
    var remainder = total;
    var target = 4;
    var groups = [];
    while (groups.length <= target && remainder > 3) {
        var val = Math.floor(Math.random() * 2 * (remainder / (target - groups.length))) + 1;
        if (val > remainder) {
            break;
        } else if (val === 0) {
            continue;
        } else {
            groups.push(val);
            remainder -= val;
        }
        console.log("remainder "+remainder+" groups "+groups.length);
    }
    if (remainder !== 0) {
        groups.push(remainder);
    }
    return groups;
};

var getAmount = function (range, likelihood) {
    if (likelihood && (Math.random() > likelihood)) {
        return 0;
    }
    console.log("in getAmount with range " + range + " and likelihood " + likelihood);
    return rollDice(range);
};

var getCharges = function(type, previouslyUsed) {
    var charges;
    switch(type) {
        case "rod":
            charges = rollDice([41,50]);
            break;
        case "staff":
            charges = rollDice([20,25]);
            break;
        case "wand":
            charges = rollDice([81,100]);
            break;
    }
    if (previouslyUsed) {
        charges = rollDie(charges);
    }
    return charges;
};

var getGemScale = function (range, die) {
    var result = 0;
    range = typeof range !== "undefined" ? range : 1;
    die = typeof die !== "undefined" ? die : 6;
    while (true) {
        result++;
        if (! inRange(rollDie(die), range)) {
            break;
        }
    }
    return result;
};

var varyGem = function (value, gemVariations, gemBaseValues, uncut) {
    var result = value;
    var uncutMult = function(value, uncut) {
        // uncut gems are worth 10%
        return Math.floor(value * (uncut ? 0.1 : 1));
    };
    // 10% chance of variation
    if (Math.random() <= 0.1) {
        var scale = 0;
        var variation = getTableItem(gemVariations);
        if (typeof variation.result === "string") {
            if (variation.result.indexOf("higher") != -1) {
                scale = getGemScale();
            } else if (variation.result.indexOf("lower") != -1) {
                scale = -getGemScale();
            }

            var classNum = gemBaseValues.indexOf(value);
            classNum += scale;
            classNum = classNum <= 0 ? 0 : classNum;
            classNum = classNum >= (gemBaseValues.length - 1) ? gemBaseValues.length - 1 : classNum;
            result = gemBaseValues[classNum];
        } else if (typeof variation.result === "number") {
            result = Math.floor(value * variation.result);
        } else if (typeof variation.result === "object") {
            result = Math.floor(value * rollDice(variation.result));
        } else {
            return false;
        }
        if ("max gem jitter" in settings) {
            var jitter = (Math.random() *
                settings["max gem jitter"] * 2) - settings["max gem jitter"];
            result = Math.floor(jitter * result);
        }
        console.log("varying gem by changing " + value + " to " + result);
    }
    return uncutMult(result, uncut);
};

var getGems = function (range, likelihood, data) {
    var total = getAmount(range, likelihood);
    var groupTotals = getGroups(total);
    console.log("groupTotals is " + JSON.stringify(groupTotals));
    var result = [];
    $.each(groupTotals, function(index, quantity) {
        var gemObj = getTableItem(data.gems);
        console.log("gemObj is " + JSON.stringify(gemObj));
        var uncut = Math.random() <= settings["probability of uncut gem"];
        result.push({
            "class": gemObj.class,
            "quantity": quantity,
            "value": varyGem(
                gemObj.value, data.variations, data.baseValues, uncut),
            "description": data.descriptions[gemObj.class][
                Math.floor(Math.random() * data.descriptions[gemObj.class].length)
                ],
            "state": uncut ? "uncut" : "faceted"
        });
    });
    return result;
};

var getPotion = function(item) {
    if (! /^Elixer of /g.test(item.item) &&
        ! /^Philter of /g.test(item.item) &&
        ! /^Oil of /g.test(item.item)) {
        return "Potion of " + item.item;
    } else {
        return item.item;
    }
};

var getObjectsOfArt = function(amount, ObjectsOfArt, descriptions, distWidth) {
    var result = [];
    while (result.length < amount) {
        var medium = getTableItem(descriptions["medium"]);
        console.log("medium is " + JSON.stringify(medium));
        var subject = getTableItem(descriptions.subject);
        var artist = getTableItem(descriptions.artist);
        var material_quality = getTableItem(descriptions["material quality"]);
        var age = getTableItem(descriptions.age);
        var size = getTableItem(descriptions.size);
        var work_quality = getTableItem(descriptions["work quality"]);
        var condition = getTableItem(descriptions.condition);
        var value_range = getTableItem(ObjectsOfArt).value;
        var value_dist_size = (value_range[1] - value_range[0]) / distWidth;
        var modifier = (subject.modifier || 0) + (artist.modifier || 0) + (material_quality.modifier || 0) + (age.modifier || 0) + (size.modifier || 0) + (work_quality.modifier || 0) + (condition.modifier || 0);
        var jitter = rollDie(value_dist_size) - (value_dist_size / 2);
        var middle_of_value_range = value_range[0] + ((value_range[1] - value_range[0]) / 2);
        var value = Math.floor(middle_of_value_range + (modifier * value_dist_size) + jitter);
        console.log("descriptions.type[medium.type] is " + JSON.stringify(descriptions.type[medium.type]));
        var material_type = getTableItem(descriptions.type[medium.type]);
        var material_prefix;
        if (material_type.hasOwnProperty("syntax")) {
            material_prefix = material_type.syntax.format(material_type);
            console.log("material_type " + JSON.stringify(material_type) + " material_prefix" + JSON.stringify(material_prefix));
        } else if (material_type.hasOwnProperty("type")) {
            if (material_type.type === 'Utensils') {
                material_prefix = "Utensil : " + getTableItem(descriptions.type.Utensils);
            } else {
                material_prefix = material_type.type;
            }
        } else {
            material_prefix = material_type;
        }
        result.push(
            {
                "value": value,
                "material": material_prefix + " (" + medium.type + ")",
                "material_quality": material_quality.type,
                    "subject": subject.type,
                "artist": {
                    "renown": artist.renown,
                    "name": getTableItem(artist.names)
                },
                "age": age.type,
                "size": size.type,
                "work quality": work_quality.type,
                "condition": condition.type
            });
    }
    return result;
};


var getContainer = function(containers, materials, number) {
    var results = [];
    for (let step = 0; step < number; step++) {
        var containerType = getTableItem(containers);
        var container = containers[containerType];
        var subType = getTableItem(container.type);
        var result = {"type": containerType, "subtype": subType};
        if (container.hasOwnProperty("materials")) {
            var material = getTableItem(container["materials"]);
            var subMaterial = getTableItem(container["materials"][material]).type;
            if (materials.hasOwnProperty(material)) {
                var materialDescription = getTableItem(materials[material][subMaterial]);
                result["material"] = material + " : " + subMaterial + " : " + materialDescription;
            } else {
                result["material"] = material + " : " + subMaterial;
            }
        }
        if (container.hasOwnProperty("security")) {
            result["security"] = getTableItem(container["security"]);
        }
        results.push(result);
    }
    return results;
};

var getArmorWeapon = function(data) {
    var result = "";
    // console.log("gg " + JSON.stringify(data));
    var item = getTableItem(data.type);
    if (item.type === "Special") {
        item = getTableItemWithReroll(data.special);
        result += item.item;
        if ("type" in item) {
            if (item.type === "roll") {
                var baseItem = getTableItemWithReroll(data.type, "Special");
                result +=
                    " (" +
                    baseItem.item +
                    " " +
                    getTableItem(data.adjustment).adjustment +
                    ")";
            } else {
                result +=
                    " (" +
                    item.type +
                    ")";
            }
        }
    } else {
        if ("quantity" in item) {
            result += item.quantity + " ";
        }
        result += item.item + " " + getTableItem(data.adjustment).adjustment;
    }
    return result;
};

var getMagicalItem = function (magicalItemType, data) {
    var item;
    var result = {"type": magicalItemType.category};
    if (magicalItemType.category === "misc") {
        item = getTableItemWithReroll(data.misc[magicalItemType.subcategory]);
    } else if (["armor", "weapon"].indexOf(magicalItemType.category) != -1) {
        item = getArmorWeapon(data[magicalItemType.category]);
    } else {
        item = getTableItemWithReroll(data[magicalItemType.category]);
    }
    switch (magicalItemType.category) {
        case "potion":
            result.item = getPotion(item);
            break;
        case "scroll":
            if (typeof item.item == "number") {
                var scrollType = getTableItem(data["wizard or priest scroll"]).type;
                if (scrollType === "priest" && item.level[1] > 7) {
                    item.level[1] -= 2;
                }
                result.item = "Scroll of level " + item.level[0] + " through " + item.level[1];
                result.spells = item.item;
                result.type = scrollType + " scroll";
            } else {
                result.item = "Scroll : " + item.item;
            }
            break;
        case "ring":
            result.item = "Ring of " + item.item;
            break;
        case "rod":
            result.item = "Rod of " + item.item;
            result.charges = getCharges(
                magicalItemType.category,
                settings["probability that rod staff wand has already been used"]);
            break;
        case "staff":
            if (["Mace", "Spear"].indexOf(item.item) != -1) {
                result.item ="Staff-" + item.item;
            } else {
                result.item = "Staff of " + item.item;
            }
            result.charges = getCharges(
                magicalItemType.category,
                settings["probability that rod staff wand has already been used"]);
            break;
        case "wand":
            result.item = "Wand of " + item.item;
            result.charges = getCharges(
                magicalItemType.category,
                settings["probability that rod staff wand has already been used"]);
            break;
        case "misc":
        case "armor":
        case "weapon":
            result.item = item;
            break;
    }
    console.log("returning " + JSON.stringify(result) + " for " + JSON.stringify(magicalItemType));
    return result;
};

var getMagicalItems = function (collections, likelihood, data) {
    if (likelihood && (Math.random() > likelihood)) {
        return [];
    }
    return collections.map(function (value, index, array) {
        var result = [];
        var magicalItemType;
        var amount = rollDice(value.range);
        var i;
        console.log("result " + JSON.stringify(result) + " amount " + amount);
        while (result.length < amount) {
            console.log("magical item is " + JSON.stringify(value));
            if (value.types.length > 1) {
                i = 0;
                while ((magicalItemType = getTableItem(data["magical items"])) && i < 20) {
                    i++;
                    console.log("magicalItemType " + JSON.stringify(magicalItemType) + " value is " + JSON.stringify(value));
                    if (value.types.indexOf(magicalItemType.category) != -1) {
                        break;
                    }
                }
            } else {
                if (value.types[0] == "any") {
                    magicalItemType = getTableItem(data["magical items"]);
                } else {
                    // since no treasure type has a magical item category of
                    // misc we can ignore subcategory here
                    magicalItemType = {
                        "category": value.types[0]};
                }
            }
            result.push(getMagicalItem(magicalItemType, data));
        }
        return result;
    });
};

var getCoins = function(range, likelihood, data) {
    if (!data.settings.containers) {
        return getAmount(range, likelihood);
    }
    var result = {};
    result.quantity = getAmount(range, likelihood);
    var number_of_containers = Math.ceil(Math.log10(result.quantity)); // This is an arbitrary decision and results in between 1 and 5 containers
    // http://mathjs.org/docs/reference/functions/std.html
    // TODO : This is where I'm at. Trying to figure out how to determine how many containers to split coins into
    var remaining = result["quantity"];
    var container_type, container_sub_type, container, material_sub_type, material;
    while (remaining > 0) {
        container_type = getTableItem(data.descriptions["treasure container map"].coins);
        container = data.descriptions.containers[container_type];
        container_sub_type = container.type;
        material_sub_type = getTableItem(container.material);
        material = data.descriptions.materials[container["material type"]][material_sub_type];
        // TODO : security
    }
};


var getTreasure = function (type, amount, data) {
    var coinTypes = ["copper", "silver", "gold", "platinum or electrum"];
    var result;
    console.log("getTreasure " + type);
    if (coinTypes.indexOf(type) != -1) {
        result = getAmount(amount.range, amount.likelihood);
    } else if (type == "gems") {
        result = getGems(amount.range, amount.likelihood, data[type]);
        console.log("gems are " + JSON.stringify(result));
    } else if (type == "art objects") {
        result = getObjectsOfArt(
            getAmount(amount.range, amount.likelihood),
            data[type],
            data["descriptions"][type],
            data["settings"]["object of art distribution width"]);
    } else if (type == "magical items") {
        //console.log("getmagicalitems " + JSON.stringify(data[type]));
        result = getMagicalItems(
            amount.collections, amount.likelihood, data[type]);
    }
    return result;
};

$(document).ready(function() {

    var callback = function(stackframes) {
        var stringifiedStack = stackframes.map(function(sf) {
            return sf.toString();
        }).join("\n");
        console.log(stringifiedStack);
    };

    var errback = function(err) { console.log(err.message); };

    window.onerror = function(msg, file, line, col, error) {
        // callback is called with an Array[StackFrame]
        StackTrace.fromError(error).then(callback).catch(errback);
    };

    $("#getTreasure").click(function () {
        var treasureType = $("#treasureType").val().toLowerCase();
        $.ajaxSetup({ cache: false });
        $.getJSON( "treasure.json", function( data ) {
            console.log("in getjson and treasuretype is " + treasureType);
            settings = data.settings;
            var treasure = data["treasure types"][treasureType];
            var result = {};
            // console.log("but now data is " + data);
            $.each(treasure, function(treasureType, treasureAmount) {
                // console.log("data is " + data + " treasureType is " + treasureType + " treasureAmount is " + treasureAmount);

                result[treasureType] = getTreasure(
                    treasureType, treasureAmount, data);
            });
            result.location = (treasureType.charCodeAt(0) >= 97) &&
            (treasureType.charCodeAt(0) <= 105) ? "lair"
                : "individual and small lair";
            result.containers = getContainer(data["descriptions"]["containers"], data["descriptions"]["materials"], 10);
            $("#result").html(JSON.stringify(result, null, "\t"));
        });
    });
});

