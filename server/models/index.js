const Database = require('./Database');
const User = require('./User');
const Video = require('./Video');
const Category = require('./Category');
const Favorite = require('./Favorite');
const Comment = require('./Comment');
const Report = require('./Report');
const Log = require('./Log');
const Settings = require('./Settings');
const ReportReason = require('./ReportReason');
const UserGroup = require('./UserGroup');
const Permission = require('./Permission');
const PasswordPolicy = require('./PasswordPolicy');
const Tag = require('./Tag');
const Playlist = require('./Playlist');
const ContentSchedule = require('./ContentSchedule');
const AuditTrail = require('./AuditTrail');

module.exports = {
    Database,
    User,
    Video,
    Category,
    Favorite,
    Comment,
    Report,
    Log,
    Settings,
    ReportReason,
    UserGroup,
    Permission,
    PasswordPolicy,
    Tag,
    Playlist,
    ContentSchedule,
    AuditTrail
};