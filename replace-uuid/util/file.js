/**
 * 一、建立目录中所有meta文件中uuid和新生成uuid的映射关系
 * 二、替换目录中指定类型文件中的uuid成新的uuid
 */
var fs = require("fs-extra");
var path = require("path");
var uuidUtils = require("./uuidUtils");
var uuidMap = {};
var Reg_Uuid = /^[0-9a-fA-F-]{36}$/;
module.exports = {
    /**
     * 递归目录找到所有meta文件的uuid
     * 参考 https://docs.cocos.com/creator/manual/zh/advanced-topics/meta.html
     */
    findDirUuid: function (dir) {
        var stat = fs.statSync(dir);
        if (!stat.isDirectory()) {
            return;
        }
        var subpaths = fs.readdirSync(dir),
            subpath;
        for (var i = 0; i < subpaths.length; ++i) {
            if (subpaths[i][0] === ".") {
                continue;
            }
            subpath = path.join(dir, subpaths[i]);
            stat = fs.statSync(subpath);
            if (stat.isDirectory()) {
                this.findDirUuid(subpath);
            } else if (stat.isFile()) {
                var metastr = subpath.substr(subpath.length - 5, 5);
                if (metastr == ".meta") {
                    var jstr = fs.readFileSync(subpath, "utf-8");
                    var json = JSON.parse(jstr);
                    if (uuidUtils.isUuid(json["uuid"])) {
                        this.updateUuidMap(json);
                        if (json["subMetas"] && typeof json["subMetas"] == "object") {
                            for (var bb in json["subMetas"]) {
                                this.updateUuidMap(json["subMetas"][bb]);
                            }
                        }
                    }
                }
            }
        }
    },
    updateUuidMap: function (json) {
        if (uuidUtils.isUuid(json["uuid"]) && !uuidMap[json["uuid"]]) {
            uuidMap[json["uuid"]] = {
                uuid: uuidUtils.uuidv4(),
            };
            if (uuidUtils.isUuid(json["rawTextureUuid"])) {
                uuidMap[json["rawTextureUuid"]] = {
                    uuid: uuidUtils.uuidv4(),
                };
            }
        }
    },
    isReplaceFile: function (subpath) {
        let conf = [".anim", ".prefab", ".fire", ".meta"];
        for (let i = 0; i < conf.length; i++) {
            let count = conf[i].length;
            if (subpath.substr(subpath.length - count, count) == conf[i]) {
                return true;
            }
        }
        return false;
    },
    //递归目录找到所有需要替换uuid的文件
    replaceDirUuid: function (dir) {
        var stat = fs.statSync(dir);
        if (!stat.isDirectory()) {
            return;
        }
        var subpaths = fs.readdirSync(dir),
            subpath;
        for (var i = 0; i < subpaths.length; ++i) {
            if (subpaths[i][0] === ".") {
                continue;
            }
            subpath = path.join(dir, subpaths[i]);
            stat = fs.statSync(subpath);
            if (stat.isDirectory()) {
                this.replaceDirUuid(subpath);
            } else if (stat.isFile()) {
                if (this.isReplaceFile(subpath)) {
                    var jstr = fs.readFileSync(subpath, "utf-8");
                    var json;
                    try {
                        json = JSON.parse(jstr);
                    } catch (error) {
                        console.log(subpath);
                    }
                    if (json) {
                        this.replaceFileUuid(json);
                        fs.writeFileSync(subpath, JSON.stringify(json, null, 2));
                    }
                }
            }
        }
    },
    //递归json对象找到所有需要替换uuid
    replaceFileUuid: function (json) {
        if (json && typeof json == "object") {
            if (json["uuid"] && uuidUtils.isUuid(json["uuid"])) {
                json["uuid"] = uuidMap[json["uuid"]].uuid;
            }
            if (json["rawTextureUuid"] && uuidUtils.isUuid(json["rawTextureUuid"])) {
                json["rawTextureUuid"] = uuidMap[json["rawTextureUuid"]].uuid;
            }
            if (json["textureUuid"] && uuidUtils.isUuid(json["textureUuid"])) {
                json["textureUuid"] = uuidMap[json["textureUuid"]].uuid;
            }
            var uuidStr = json["__uuid__"];
            if (uuidStr && uuidUtils.isUuid(uuidStr)) {
                //资源
                if (Reg_Uuid.test(uuidStr)) {
                    if (uuidMap[uuidStr]) {
                        json["__uuid__"] = uuidMap[uuidStr].uuid;
                    }
                } else {
                    var uuidStr = uuidUtils.decompressUuid(uuidStr);
                    if (uuidMap[uuidStr]) {
                        json["__uuid__"] = UuidUtils.compressUuid(
                            uuidMap[uuidStr],
                            false
                        );
                    }
                }
            }
            var typeStr = json["__type__"];
            if (typeStr && uuidUtils.isUuid(typeStr)) {
                //自定义脚本
                if (Reg_Uuid.test(typeStr)) {
                    if (uuidMap[typeStr]) {
                        json["__type__"] = uuidMap[typeStr].uuid;
                    }
                } else {
                    //cocos为了减少数据量，做了一次特殊的 base64 编码
                    var de__type__ = uuidUtils.decompressUuid(typeStr);
                    if (uuidMap[de__type__]) {
                        json["__type__"] = uuidUtils.compressUuid(
                            uuidMap[de__type__].uuid,
                            false
                        );
                    }
                }
            }
            if (Object.prototype.toString.call(json) === "[object Array]") {
                for (var prebidx = 0; prebidx < json.length; prebidx++) {
                    if (json[prebidx] && typeof json[prebidx] == "object") {
                        this.replaceFileUuid(json[prebidx]);
                    }
                }
            } else if (Object.prototype.toString.call(json) === "[object Object]") {
                for (var prebidx in json) {
                    if (json[prebidx] && typeof json[prebidx] == "object") {
                        this.replaceFileUuid(json[prebidx]);
                    }
                }
            }
        }
    },
};
