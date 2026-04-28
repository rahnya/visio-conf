import User from "../models/user.js";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import SocketIdentificationService from "./SocketIdentification.js";

class UsersService {
    controleur;
    verbose = false;
    listeDesMessagesEmis = new Array(
        "login_response",
        "signup_response",
        "users_list_response",
        "update_user_response",
        "update_user_status_response",
        "update_user_roles_response",
        "user_perms_response",
        "user_info_response",
        "create_user_response"
    );
    listeDesMessagesRecus = new Array(
        "login_request",
        "signup_request",
        "users_list_request",
        "update_user_request",
        "update_user_status_request",
        "update_user_roles_request",
        "delete_role_request",
        "user_perms_request",
        "user_info_request",
        "create_user_request"
    );

    constructor(c, nom) {
        this.controleur = c;
        this.nomDInstance = nom;
        if (this.controleur.verboseall || this.verbose)
            console.log(
                "INFO (" +
                    this.nomDInstance +
                    "):  s'enregistre aupres du controleur"
            );

        this.controleur.inscription(
            this,
            this.listeDesMessagesEmis,
            this.listeDesMessagesRecus
        );
    }

    createToken = (user) => {
        return jwt.sign(
            {
                userId: user._id,
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );
    };

    async traitementMessage(mesg) {
        if (this.controleur.verboseall || this.verbose) {
            console.log(
                "INFO (" +
                    this.nomDInstance +
                    "): reçoit le message suivant à traiter"
            );
            console.log(mesg);
        }

        if (mesg.login_request) {
            await this.handleLogin(mesg);
        }

        if (mesg.signup_request) {
            await this.handleSignup(mesg);
        }

        if (mesg.create_user_request) {
            await this.handleCreateUser(mesg);
        }

        if (mesg.users_list_request) {
            await this.getUsersList(mesg);
        }

        if (mesg.user_info_request) {
            await this.getUserInfo(mesg);
        }

        if (mesg.update_user_roles_request) {
            const req = mesg.update_user_roles_request;
            console.log("PASSWORD REÇU:", JSON.stringify(req.password));
            const updateData = {
                firstname: req.firstname,
                lastname: req.lastname,
                email: req.email,
                phone: req.phone,
                job: req.job,
                desc: req.desc,
                roles: req.roles,
            };

            // Ne change le mot de passe QUE si le champ est rempli
            if (req.password && req.password.trim() !== "") {
                updateData.password = await this.sha256(req.password);
            }

            const user = await User.findOneAndUpdate(
                { uuid: req.user_id },
                updateData,
                { new: true }
            );
            if (!user) throw new Error("User not found");

            const socketId = SocketIdentificationService.getUserSocketId(
                user._id?.toString()
            );
            const message = {
                update_user_roles_response: {
                    userId: mesg.update_user_roles_request.user_id,
                },
                id: [mesg.id, socketId].filter(Boolean),
            };
            this.controleur.envoie(this, message);
        }

        if (mesg.user_perms_request) {
            const user = await User.findOne({
                uuid: mesg.user_perms_request.userId,
            }).populate({
                path: "roles",
                populate: { path: "role_permissions" },
            });

            if (!user) {
                const message = {
                    user_perms_response: {
                        perms: [],
                        error: "Utilisateur non trouvé",
                    },
                    id: [mesg.id],
                };
                this.controleur.envoie(this, message);
                return;
            }

            let perms = [];
            if (user.roles && Array.isArray(user.roles)) {
                user.roles.forEach((role) => {
                    if (role && role.role_permissions) {
                        role.role_permissions.forEach((perm) => {
                            if (
                                perm &&
                                perm.permission_uuid &&
                                !perms.includes(perm.permission_uuid)
                            ) {
                                perms.push(perm.permission_uuid);
                            }
                        });
                    }
                });
            }

            const message = {
                user_perms_response: {
                    perms: perms,
                },
                id: [mesg.id],
            };
            this.controleur.envoie(this, message);
        }

        if (mesg.delete_role_request) {
            await User.updateMany(
                {},
                { $pull: { roles: mesg.delete_role_request.role_id } }
            );
        }

        if (mesg.update_user_status_request) {
            const action = mesg.update_user_status_request.action;

            const newStatus =
                action === "activate"
                    ? "active"
                    : action === "deactivate"
                    ? "deleted"
                    : "banned";
            const user = await User.findOneAndUpdate(
                { uuid: mesg.update_user_status_request.user_id },
                { status: newStatus },
                { new: true }
            );
            if (!user) throw new Error("User not found");

            const message = {
                update_user_status_response: {
                    etat: true,
                    action: action,
                },
                id: [mesg.id],
            };
            this.controleur.envoie(this, message);
        }

        if (mesg.update_user_request) {
            await this.updateUser(mesg);
        }
    }

    async handleLogin(mesg) {
        try {
            const { email, password } = mesg.login_request;
            const hashedPassword = await this.sha256(password);

            const user = await User.findOne({ email });

            if (!user) {
                throw new Error("Invalid credentials");
            }

            if (user.status !== "active") {
                throw new Error("Account disabled");
            }

            if (user.password !== hashedPassword) {
                throw new Error("Invalid credentials");
            }

            const token = this.createToken(user);

            const message = {
                login_response: { etat: true, token },
                id: [mesg.id],
            };

            this.controleur.envoie(this, message);
        } catch (error) {
            const message = {
                login_response: { etat: false, error: error.message },
                id: [mesg.id],
            };
            this.controleur.envoie(this, message);
        }
    }

    async handleSignup(mesg) {
        try {
            const { email, password, firstname, lastname, phone, job, desc } =
                mesg.signup_request;

            const existingUser = await User.findOne({ email });
            if (existingUser) {
                throw new Error("User already exists");
            }

            const hashedPassword = await this.sha256(password);

            const user = new User({
                uuid: uuidv4(),
                email,
                password: hashedPassword,
                firstname,
                lastname,
                phone,
                job,
                desc,
                picture: "default_profile_picture.png",
            });
            await user.save();
            const token = this.createToken(user);
            const message = {
                signup_response: { etat: true, token },
                id: [mesg.id],
            };
            this.controleur.envoie(this, message);
        } catch (error) {
            const message = {
                signup_response: {
                    etat: false,
                    error: error.message,
                },
                id: [mesg.id],
            };
            this.controleur.envoie(this, message);
        }
    }

    async getUsersList(mesg) {
        try {
            const users = await User.find(
                {},
                "uuid firstname lastname email picture status roles is_online phone job desc disturb_status"
            ).populate("roles", "role_label");
            const formattedUsers = users.map((user) => ({
                id: user.uuid,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                picture: user.picture,
                status: user.status,
                roles: user.roles
                    ? user.roles.map((role) => ({
                        _id: role._id,
                        role_label: role.role_label
                    }))
                    : [],
                online: user.is_online,
                phone: user.phone,
                job: user.job,
                desc: user.desc,
                disturb_status: user.disturb_status,
            }));
            const message = {
                users_list_response: {
                    etat: true,
                    users: formattedUsers,
                },
                id: [mesg.id],
            };
            this.controleur.envoie(this, message);
        } catch (error) {
            const message = {
                users_list_response: {
                    etat: false,
                    error: error.message,
                },
                id: [mesg.id],
            };
            this.controleur.envoie(this, message);
        }
    }

    async updateUser(mesg) {
        try {
            const socketId = mesg.id;
            if (!socketId)
                throw new Error("Sender socket id not available for update");
            const fieldsToUpdate = mesg.update_user_request;
            const userInfo =
                await SocketIdentificationService.getUserInfoBySocketId(
                    socketId
                );
            if (!userInfo) throw new Error("User not found based on socket id");
            const user = await User.findOneAndUpdate(
                { _id: userInfo._id },
                fieldsToUpdate,
                { new: true }
            ).populate("roles", "role_label");
            if (!user) throw new Error("User not found");
            const newUserInfo = {
                id: user.uuid,
                uuid: user.uuid,
                _id: user._id.toString(),
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                picture: user.picture,
                phone: user.phone,
                job: user.job,
                desc: user.desc,
                disturb_status: user.disturb_status,
                roles: user.roles
                    ? user.roles.map((role) => role.role_label)
                    : [],
                date_create: user.date_create || user.createdAt || null,
                last_connection: user.last_connection || null,
            };
            const message = {
                update_user_response: {
                    etat: true,
                    newUserInfo,
                },
                id: [mesg.id],
            };
            this.controleur.envoie(this, message);
        } catch (error) {
            const message = {
                update_user_response: {
                    etat: false,
                    error: error.message,
                    newUserInfo: null,
                },
                id: [mesg.id],
            };
            this.controleur.envoie(this, message);
        }
    }

    async getUserInfo(mesg) {
        try {
            const { userId } = mesg.user_info_request;

            if (!userId) {
                throw new Error("User ID is required");
            }

            let user = null;
            if (
                userId &&
                userId.length === 24 &&
                /^[0-9a-fA-F]{24}$/.test(userId)
            ) {
                user = await User.findById(
                    userId,
                    "uuid firstname lastname email picture phone job desc roles disturb_status date_create last_connection"
                ).populate("roles", "role_label");
            }

            if (!user) {
                user = await User.findOne(
                    { uuid: userId },
                    "uuid firstname lastname email picture phone job desc roles disturb_status date_create last_connection"
                ).populate("roles", "role_label");
            }

            if (user) {
                const userInfo = {
                    id: user.uuid,
                    uuid: user.uuid,
                    _id: user._id.toString(),
                    firstname: user.firstname,
                    lastname: user.lastname,
                    email: user.email,
                    picture: user.picture,
                    phone: user.phone,
                    job: user.job,
                    desc: user.desc,
                    disturb_status: user.disturb_status,
                    roles: user.roles
                        ? user.roles.map((role) => role.role_label)
                        : [],
                    date_create: user.date_create || user.createdAt || null,
                    last_connection: user.last_connection || null,
                };
                const message = {
                    user_info_response: { etat: true, userInfo },
                    id: [mesg.id],
                };
                this.controleur.envoie(this, message);
            } else {
                throw new Error("User not found");
            }
        } catch (error) {
            console.warn(
                `getUserInfo failed for socket ${mesg.id}: ${error.message}`
            );
            const message = {
                user_info_response: {
                    etat: false,
                    error:
                        error.message === "User not found"
                            ? "AUTHENTICATION_REQUIRED"
                            : error.message,
                },
                id: [mesg.id],
            };
            this.controleur.envoie(this, message);
        }
    }

    async handleCreateUser(mesg) {
        console.log("CREATE USER BACKEND REÇU", mesg);
        console.log("ID SOCKET reçu:", mesg.id);

        // Garde-fou : si pas de socket id, on ne peut pas répondre
        if (!mesg.id) {
            console.error("handleCreateUser : pas de socket id dans mesg, impossible d'envoyer la réponse");
            return;
        }

        try {
            const { email, firstname, lastname, phone, job, desc } =
                mesg.create_user_request;

            if (!email || !firstname || !lastname) {
                throw new Error("Email, prénom et nom sont requis");
            }

            const existingUser = await User.findOne({ email });
            if (existingUser) {
                throw new Error("Un utilisateur avec cet email existe déjà");
            }

            const tempPassword =
                Math.random().toString(36).substring(2, 15) +
                Math.random().toString(36).substring(2, 15);
            const hashedPassword = await this.sha256(tempPassword);

            const user = new User({
                uuid: uuidv4(),
                email,
                password: hashedPassword,
                firstname,
                lastname,
                phone: phone || "",
                job: job || "",
                desc: desc || "",
                picture: "default_profile_picture.png",
                status: "waiting",
            });
            await user.save();

            console.log("Utilisateur créé en base, envoi de la réponse à", mesg.id);

            const message = {
                create_user_response: {
                    success: true,
                    userId: user.uuid,
                    tempPassword: tempPassword,
                    message: "Utilisateur créé avec succès",
                },
                id: [mesg.id],
            };
            this.controleur.envoie(this, message);
        } catch (error) {
            console.error("handleCreateUser erreur:", error.message);
            const message = {
                create_user_response: {
                    success: false,
                    message: error.message || "Erreur lors de la création de l'utilisateur",
                },
                id: [mesg.id],
            };
            this.controleur.envoie(this, message);
        }
    }

    sha256 = async (text) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = crypto.createHash("sha256").update(data).digest();
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    };
}

export default UsersService;