/*Author : Matthieu BIVILLE*/

import { useAppContext } from "@/context/AppContext";
import { useEffect, useState } from "react";
import styles from "./UpdateUserRole.module.css";
import { Typography } from "@mui/material";
import CustomSnackBar from "../../SnackBar";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { Role } from "@/types/Role";

export default function CreateUser({
    setCreateUser,
}: {
    setCreateUser: Function;
}) {
    const [roleList, setRoleList] = useState<Role[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [openDropDown, setOpenDropDown] = useState<boolean>(true);

    const [openAlert, setOpenAlert] = useState<boolean>(false);
    const [alertSeverity, setAlertSeverity] = useState<
        "success" | "error" | "warning" | "info"
    >("success");
    const [alertMessage, setAlertMessage] = useState<string>("");

    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [firstname, setFirstname] = useState<string>("");
    const [lastname, setLastname] = useState<string>("");
    const [phone, setPhone] = useState<string>("");
    const [job, setJob] = useState<string>("");
    const [desc, setDesc] = useState<string>("");

    // After signup succeeds we need the new user's id to assign roles.
    // We store the email and wait for the updated users list.
    const [pendingRoles, setPendingRoles] = useState<string[] | null>(null);
    const [pendingEmail, setPendingEmail] = useState<string>("");

    const nomDInstance = "Create User";
    const verbose = false;
    const { controleur, canal } = useAppContext();

    const listeMessageEmis = [
        "signup_request",
        "roles_list_request",
        "users_list_request",
        "update_user_roles_request",
    ];
    const listeMessageRecus = [
        "signup_response",
        "roles_list_response",
        "users_list_response",
        "update_user_roles_response",
    ];

    const handler = {
        nomDInstance,
        traitementMessage: (msg: {
            signup_response?: any;
            roles_list_response?: any;
            users_list_response?: any;
            update_user_roles_response?: any;
        }) => {
            if (verbose || controleur?.verboseall)
                console.log(
                    `INFO: (${nomDInstance}) - traitementMessage - `,
                    msg
                );

            if (msg.signup_response) {
                if (msg.signup_response.etat) {
                    // If roles were selected, fetch the users list to find the new user's id
                    if (pendingRoles && pendingRoles.length > 0) {
                        controleur.envoie(handler, { users_list_request: 1 });
                    } else {
                        setAlertMessage("Utilisateur créé avec succès !");
                        setAlertSeverity("success");
                        setOpenAlert(true);
                        setTimeout(() => setCreateUser(false), 1500);
                    }
                } else {
                    setAlertMessage(
                        msg.signup_response.error === "User already exists"
                            ? "Un compte avec cet email existe déjà."
                            : `Erreur : ${msg.signup_response.error}`
                    );
                    setAlertSeverity("error");
                    setOpenAlert(true);
                }
            }

            if (msg.roles_list_response) {
                setRoleList(msg.roles_list_response);
            }

            // After signup + users_list arrives, find the new user by email and assign roles
            if (msg.users_list_response && pendingRoles && pendingEmail) {
                const newUser = msg.users_list_response.users?.find(
                    (u: any) => u.email === pendingEmail
                );
                if (newUser && pendingRoles.length > 0) {
                    controleur.envoie(handler, {
                        update_user_roles_request: {
                            user_id: newUser.id,
                            firstname: newUser.firstname,
                            lastname: newUser.lastname,
                            email: newUser.email,
                            phone: newUser.phone ?? "",
                            job: newUser.job ?? "",
                            desc: newUser.desc ?? "",
                            roles: pendingRoles,
                        },
                    });
                } else {
                    // Roles could not be found yet — just return
                    setAlertMessage("Utilisateur créé avec succès !");
                    setAlertSeverity("success");
                    setOpenAlert(true);
                    setTimeout(() => setCreateUser(false), 1500);
                }
                setPendingRoles(null);
                setPendingEmail("");
            }

            if (msg.update_user_roles_response) {
                setAlertMessage(
                    "Utilisateur créé et rôles assignés avec succès !"
                );
                setAlertSeverity("success");
                setOpenAlert(true);
                setTimeout(() => setCreateUser(false), 1500);
            }
        },
    };

    useEffect(() => {
        if (controleur && canal) {
            controleur.inscription(handler, listeMessageEmis, listeMessageRecus);
        }
        return () => {
            if (controleur) {
                controleur.desincription(
                    handler,
                    listeMessageEmis,
                    listeMessageRecus
                );
            }
        };
    }, [controleur, canal]);

    useEffect(() => {
        if (controleur) {
            controleur.envoie(handler, { roles_list_request: 1 });
        }
    }, [controleur]);

    const handleCreateUser = () => {
        if (!firstname.trim() || !lastname.trim() || !email.trim() || !password.trim()) {
            setAlertMessage("Prénom, nom, email et mot de passe sont obligatoires.");
            setAlertSeverity("error");
            setOpenAlert(true);
            return;
        }

        // Store pending context before sending, so the response handler can use them
        setPendingRoles(selectedRoles.length > 0 ? [...selectedRoles] : null);
        setPendingEmail(email.trim());

        controleur.envoie(handler, {
            signup_request: {
                email: email.trim(),
                password: password,
                firstname: firstname.trim(),
                lastname: lastname.trim(),
                phone: phone.trim(),
                job: job.trim(),
                desc: desc.trim(),
            },
        });
    };

    const handleCheckboxChange = (role: Role) => {
        setSelectedRoles((prev) => {
            const isSelected = prev.includes(role._id);
            return isSelected
                ? prev.filter((r) => r !== role._id)
                : [...prev, role._id];
        });
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "left" }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        columnGap: "20px",
                    }}
                >
                    <img
                        src="/icons/User_Friend.svg"
                        alt=""
                        className={styles.icon}
                    />
                    <Typography
                        variant="subtitle1"
                        className={styles.title}
                        style={{ fontSize: "32px", fontWeight: 700 }}
                    >
                        Créer un nouvel utilisateur
                    </Typography>
                </div>
            </div>

            {/* Form */}
            <div className={styles.signupForm}>
                <div className={styles.formGroupRow}>
                    <div className={styles.formGroup}>
                        <label htmlFor="firstname">Prénom *</label>
                        <input
                            type="text"
                            id="firstname"
                            value={firstname}
                            onChange={(e) => setFirstname(e.target.value)}
                            placeholder="Jean"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="lastname">Nom *</label>
                        <input
                            type="text"
                            id="lastname"
                            value={lastname}
                            onChange={(e) => setLastname(e.target.value)}
                            placeholder="Dupont"
                        />
                    </div>
                </div>

                <div className={styles.formGroupRow}>
                    <div className={styles.formGroup}>
                        <label htmlFor="email">Email *</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="jean.dupont@example.com"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="password">Mot de passe *</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <div className={styles.formGroupRow}>
                    <div className={styles.formGroup}>
                        <label htmlFor="phone">N° Téléphone</label>
                        <input
                            type="text"
                            id="phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="06 12 34 56 78"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="job">Poste</label>
                        <input
                            type="text"
                            id="job"
                            value={job}
                            onChange={(e) => setJob(e.target.value)}
                            placeholder="Développeur"
                        />
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label htmlFor="desc">Description</label>
                    <input
                        type="text"
                        id="desc"
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        placeholder="Bio courte..."
                        style={{ width: "85%" }}
                    />
                </div>
            </div>

            {/* Role selection */}
            <div className={styles.perms}>
                <div className={styles.dropDown}>
                    <p
                        className={styles.addPerm}
                        onClick={() => setOpenDropDown(!openDropDown)}
                    >
                        Assigner des rôles
                        {openDropDown ? (
                            <ChevronUp size={30} color="#223A6A" />
                        ) : (
                            <ChevronDown size={30} color="#223A6A" />
                        )}
                    </p>
                    {openDropDown && (
                        <div
                            style={{
                                overflowY: "auto",
                                scrollbarWidth: "thin",
                                height: "calc(100% - 58px)",
                            }}
                        >
                            {roleList?.map((role, index) => (
                                <p
                                    key={role._id}
                                    style={{
                                        backgroundColor:
                                            index % 2 ? "#EAEAEA" : "white",
                                    }}
                                    className={styles.option}
                                >
                                    {role.role_label}
                                    <input
                                        type="checkbox"
                                        style={{ width: "25px", height: "25px" }}
                                        onChange={() =>
                                            handleCheckboxChange(role)
                                        }
                                        checked={selectedRoles.includes(role._id)}
                                    />
                                </p>
                            ))}
                            {roleList?.length === 0 && (
                                <p className={styles.option} style={{ color: "gray", fontStyle: "italic" }}>
                                    Aucun rôle disponible
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className={styles.dropDown}>
                    <p className={styles.addPerm}>
                        Rôles sélectionnés
                        <Check size={30} color="#223A6A" />
                    </p>
                    <div
                        style={{
                            overflowY: "auto",
                            scrollbarWidth: "thin",
                            height: "calc(100% - 58px)",
                        }}
                    >
                        {roleList?.map((role, index) => {
                            if (selectedRoles.includes(role._id)) {
                                return (
                                    <p
                                        key={role._id}
                                        style={{
                                            backgroundColor:
                                                index % 2 ? "#EAEAEA" : "white",
                                        }}
                                        className={styles.option}
                                    >
                                        {role.role_label}
                                    </p>
                                );
                            }
                        })}
                        {selectedRoles.length === 0 && (
                            <p className={styles.option} style={{ color: "gray", fontStyle: "italic" }}>
                                Aucun rôle sélectionné
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button
                    onClick={() => setCreateUser(false)}
                    className={styles.button}
                    style={{ background: "red" }}
                >
                    <X size={26} color="white" /> Annuler
                </button>
                <button
                    onClick={handleCreateUser}
                    className={styles.button}
                    style={{ background: "#223A6A" }}
                >
                    <Check size={26} color="white" /> Créer
                </button>
            </div>

            <CustomSnackBar
                open={openAlert}
                setOpen={setOpenAlert}
                msg={alertMessage}
                severity={alertSeverity}
            />
        </div>
    );
}
